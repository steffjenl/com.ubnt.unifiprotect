/* eslint-disable no-console */

'use strict';

const Homey = require('homey');
const WebSocket = require('ws');
const zlib = require('zlib');

const UfvDiscovery = require('./ufvdiscovery');
const UfvConstants = require('./ufvconstants');

class UfPWebsocket {
  constructor() {
    this._eventListener = null;
  }

  // Return the realtime update events API URL.
  updatesUrl() {

    return 'wss://' + Homey.app.api.getHost() + '/proxy/protect/ws/updates';
  }

  // Connect to the realtime update events API.
  launchUpdatesListener() {

    // If we already have a listener, we're already all set.
    if (this._eventListener) {
      return true;
    }

    const params = new URLSearchParams({ lastUpdateId: Homey.app.api._lastUpdateId });

    Homey.app.log('Update listener: %s', this.updatesUrl() + '?' + params.toString());

    try {
      const _ws = new WebSocket(this.updatesUrl() + '?' + params.toString(), {
        headers: {
          Cookie: Homey.app.api.getProxyCookieToken()
        },
        rejectUnauthorized: false
      });

      if (!_ws) {
        Homey.app.log('Unable to connect to the realtime update events API. Will retry again later.');
        this._eventListener = null;
        this._eventListenerConfigured = false;
        return false;
      }

      this._eventListener = _ws;

      // Setup our heartbeat to ensure we can revive our connection if needed.
      this._eventListener.on('message', this.heartbeatEventListener.bind(this));
      this._eventListener.on('open', this.heartbeatEventListener.bind(this));
      this._eventListener.on('ping', this.heartbeatEventListener.bind(this));
      this._eventListener.on('close', () => {

        clearTimeout(this._eventHeartbeatTimer);

      });

      this._eventListener.on('error', (error) => {

        // If we're closing before fully established it's because we're shutting down the API - ignore it.
        if (error.message !== 'WebSocket was closed before the connection was established') {
          Homey.app.log('%s: %s', Homey.app.api.getHost(), error);
        }

        this._eventListener.terminate();
        this._eventListener = null;
        this._eventListenerConfigured = false;

      });

      Homey.app.log('%s: Connected to the UniFi realtime update events API.', Homey.app.api.getNvrName());
    } catch (error) {
      Homey.app.log('%s: Error connecting to the realtime update events API: %s', Homey.app.api.getNvrName(), error);
    }

    return true;
  }

  disconnectEventListener() {
    this._eventListener.terminate();
    this._eventListener = null;
    this._eventListenerConfigured = false;
  }

  heartbeatEventListener() {

    // Clear out our last timer and set a new one.
    clearTimeout(this._eventHeartbeatTimer);

    // We use terminate() to immediately destroy the connection, instead of close(), which waits for the close timer.
    this._eventHeartbeatTimer = setTimeout(() => {
      this._eventListener.terminate();
      this._eventListener = null;
      this._eventListenerConfigured = false;
    }, UfvConstants.PROTECT_EVENTS_HEARTBEAT_INTERVAL * 1000);
  }

  // Configure the realtime update events API listener to trigger events on accessories, like motion.
  configureUpdatesListener(driver) {

    // The event listener API only works on UniFi OS devices.
    if (!Homey.app.api._useProxy) {
      return false;
    }

    // Only configure the event listener if it exists and it's not already configured.
    if (!this._eventListener || this._eventListenerConfigured) {
      return true;
    }

    // Listen for any messages coming in from our listener.
    this._eventListener.on('message', (event) => {

      const updatePacket = this.decodeUpdatePacket(event);

      if (!updatePacket) {
        Homey.app.log('%s: Unable to process message from the realtime update events API.', Homey.app.api.getNvrName());
        return;
      }

      // Update actions that we care about (doorbell rings, motion detection) look like this:
      //
      // action: "update"
      // id: "someCameraId"
      // modelKey: "camera"
      // newUpdateId: "ignorethis"
      //
      // The payloads are what differentiate them - one updates lastMotion and the other lastRing.

      // Filter on what actions we're interested in only.
      if ((updatePacket.action.action !== 'update') || (updatePacket.action.modelKey !== 'camera')) {
        return;
      }

      const payload = updatePacket.payload;
      if (typeof payload.isMotionDetected === "undefined" && !payload.lastRing) {
        return;
      }

      const accessory = driver.getDeviceById(updatePacket.action.id);
      if (!accessory) {
        return;
      }

      if (typeof payload.lastRing === "undefined") {
        if (payload.lastMotion) {
          driver.onParseWebsocketMotionData(accessory, payload.lastMotion, payload.isMotionDetected);
        }
        return;
      }

      if (payload.lastRing) {
        driver.onParseWebsocketLastRingData(accessory, payload.lastRing);
        return;
      }
    });
    this._eventListenerConfigured = true;
    return true;
  }

  // Process an update data packet and return the action and payload.
  decodeUpdatePacket(packet) {

    // What we need to do here is to split this packet into the header and payload, and decode them.

    let dataOffset;

    try {

      // The fourth byte holds our payload size. When you add the payload size to our header frame size, you get the location of the
      // data header frame.
      dataOffset = packet.readUInt32BE(4) + UfvConstants.UPDATE_PACKET_HEADER_SIZE;

      // Validate our packet size, just in case we have more or less data than we expect. If we do, we're done for now.
      if (packet.length !== (dataOffset + UfvConstants.UPDATE_PACKET_HEADER_SIZE + packet.readUInt32BE(dataOffset + 4))) {
        throw new Error('Packet length doesn\'t match header information.');
      }

    } catch (error) {

      Homey.app.log('Realtime update API: error decoding update packet: %s', error);
      return null;

    }

    // Decode the action and payload frames now that we know where everything is.
    const actionFrame = this.decodeUpdateFrame(packet.slice(0, dataOffset), 1);
    const payloadFrame = this.decodeUpdateFrame(packet.slice(dataOffset), 2);

    if (!actionFrame || !payloadFrame) {
      return null;
    }

    return ({
      action: actionFrame,
      payload: payloadFrame
    });
  }

  // Decode a frame, composed of a header and payload, received through the update events API.
  decodeUpdateFrame(packet, packetType) {

    // Read the packet frame type.
    const frameType = packet.readUInt8(0);

    // This isn't the frame type we were expecting - we're done.
    if (packetType !== frameType) {
      return null;
    }

    // Read the payload format.
    const payloadFormat = packet.readUInt8(1);

    // Check to see if we're compressed or not, and inflate if needed after skipping past the 8-byte header.
    const payload = packet.readUInt8(2) ? zlib.inflateSync(packet.slice(UfvConstants.UPDATE_PACKET_HEADER_SIZE)) : packet.slice(UfvConstants.UPDATE_PACKET_HEADER_SIZE);

    // If it's an action, it can only have one format.
    if (frameType === 1) {
      return (payloadFormat === 1) ? JSON.parse(payload.toString()) : null;
    }

    // Process the payload format accordingly.
    switch (payloadFormat) {
      case 1:
        // If it's data payload, it can be anything.
        return JSON.parse(payload.toString());
        break;

      case 2:
        return payload.toString('utf8');
        break;

      case 3:
        return payload;
        break;

      default:
        Homey.app.log('Unknown payload packet type received in the realtime update events API: %s.', payloadFormat);
        return null;
        break;
    }
  }
}

module.exports = UfPWebsocket;
