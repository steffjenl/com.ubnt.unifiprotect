/* eslint-disable no-console */

'use strict';

const Homey = require('homey');
const WebSocket = require('ws');
const zlib = require('zlib');

const UfvDiscovery = require('./ufvdiscovery');
const UfvConstants = require('./ufvconstants');

const ManagerApi = Homey.ManagerApi;

class UfPWebsocket {
  constructor() {
    this._eventListener = null;
    this._pingPong = null;

    this._counter = 0;

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

    Homey.app.debug('Update listener: ' + this.updatesUrl() + '?' + params.toString());

    try {
      ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, 'Connecting');

      const _ws = new WebSocket(this.updatesUrl() + '?' + params.toString(), {
        headers: {
          Cookie: Homey.app.api.getProxyCookieToken()
        },
        rejectUnauthorized: false
      });

      if (!_ws) {
        Homey.app.debug('Unable to connect to the realtime update events API. Will retry again later.');
        this._eventListener = null;
        this._eventListenerConfigured = false;
        return false;
      }

      this._eventListener = _ws;

      this._pingPong = setInterval(() => {
        this.sendPingPongMessage();
      }, 15000);

      // Received pong
      this._eventListener.on('pong', (event) => {
        // update lastPong variable
        let lastPong = new Date().toLocaleString('nl-NL');
        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_LASTPONG, lastPong);
        Homey.app.debug(Homey.app.api.getNvrName() + ': Received pong from websocket.');
      });

      // Received ping
      this._eventListener.on('message', (event) => {
        // update lastPong variable
        let lastMessage = new Date().toLocaleString('nl-NL');
        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_LASTMESSAGE, lastMessage);
      });

      // Connection opened
      this._eventListener.on('open', (event) => {
        Homey.app.debug(Homey.app.api.getNvrName() + ': Connected to the UniFi realtime update events API.');
        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, 'Connected');
      });

      this._eventListener.on('close', () => {
        // terminate and cleanup websocket connection and timers
        this._eventListener = null;
        this._eventListenerConfigured = false;
        clearInterval(this._pingPong);
        clearTimeout(this._eventHeartbeatTimer);
        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, 'Disconnected');
      });

      this._eventListener.on('error', (error) => {
        Homey.app.debug(error);

        // If we're closing before fully established it's because we're shutting down the API - ignore it.
        if (error.message !== 'WebSocket was closed before the connection was established') {
          Homey.app.debug(Homey.app.api.getHost(), +': ' + error);
        }

        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, error.message);

        if (this._eventListener) {
          // terminate and cleanup websocket connection and timers
          this._eventListener.terminate();
          this._eventListener = null;
          this._eventListenerConfigured = false;
        }
        clearInterval(this._pingPong);

        // reconnect websocket connection
        this.reconnectUpdatesListener();
      });
    } catch (error) {
      Homey.app.debug(Homey.app.api.getNvrName() + ': Error connecting to the realtime update events API: ' + error);
      ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, error);
    }

    return true;
  }

  disconnectEventListener() {
    return new Promise((resolve, reject) => {
      if (typeof this._eventListener !== 'undefined' && this._eventListener !== null) {
        Homey.app.debug('Called terminate websocket');
        this._eventListener.terminate();
        this._eventListener = null;
        clearInterval(this._pingPong);
        this._pingPong = null;
      }
      this._eventListenerConfigured = false;
      resolve(true);
    });
  }

  reconnectUpdatesListener() {
    Homey.app.debug('Called reconnectUpdatesListener');
    this.disconnectEventListener().then((res) => {
      this.waitForBootstrap().bind(this);
    }).catch();
  }

  waitForBootstrap() {
      if (typeof Homey.app.api._lastUpdateId !== 'undefined' && Homey.app.api._lastUpdateId !== null) {
        Homey.app.debug('Called waitForBootstrap');
        this.launchUpdatesListener();
        this.configureUpdatesListener(this);
      } else {
        Homey.app.debug('Calling waitForBootstrap');
        setTimeout(this.waitForBootstrap.bind(this), 250);
      }
  }

  sendPingPongMessage() {
    Homey.app.debug(Homey.app.api.getNvrName() + ': Sending ping to websocket.');
    if (this._eventListener !== null) {
      this._eventListener.send('ping');
      Homey.app.debug(Homey.app.api.getNvrName() + ': Send ping to websocket.');
    }
  }

  // Configure the realtime update events API listener to trigger events on accessories, like motion.
  configureUpdatesListener() {

    this._counter++;

    // Only configure the event listener if it exists and it's not already configured.
    if (!this._eventListener || this._eventListenerConfigured) {
      return true;
    }

    // Listen for any messages coming in from our listener.
    this._eventListener.on('message', (event) => {

      const updatePacket = this.decodeUpdatePacket(event);

      if (!updatePacket) {
        Homey.app.debug(Homey.app.api.getNvrName() + ': Unable to process message from the realtime update events API.');
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

      // get protectcamera driver
      const driver = Homey.ManagerDrivers.getDriver('protectcamera');
      // get payload from updatePacket
      const payload = updatePacket.payload;

      // Received new websocket message
      // Homey.app.debug(Homey.app.api.getNvrName() + ': Received new websocket message (' + JSON.stringify(updatePacket) + ')');
      Homey.app.debug(Homey.app.api.getNvrName() + ': ' + this._counter + ' Received new websocket message');

      if (!payload.lastMotion && !payload.lastRing) {
        return;
      }

      const device = driver.getDeviceById(updatePacket.action.id);
      if (!device) {
        return;
      }

      // Debug information about playload
      Homey.app.debug(JSON.stringify(payload));

      if (payload.lastMotion) {
        driver.onParseWebsocketMotionData(device, payload.lastMotion, payload.isMotionDetected);
      }

      if (payload.lastRing) {
        driver.onParseWebsocketLastRingData(device, payload.lastRing);
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

      Homey.app.debug('Realtime update API: error decoding update packet: %s', error);
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
        Homey.app.debug('Unknown payload packet type received in the realtime update events API: %s.', payloadFormat);
        return null;
        break;
    }
  }
}

module.exports = UfPWebsocket;
