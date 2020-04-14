'use strict';

const Homey = require('homey');
const UfPapi = require('./lib/ufpapi');
const UfvConstants = require('./lib/ufvconstants');

class UniFiProtect extends Homey.App {
  async onInit() {
    // Register snapshot image token
    this.snapshotToken = new Homey.FlowToken('ufv_snapshot', {
      type: 'image',
      title: 'Snapshot',
    });
    Homey.ManagerFlow.registerToken(this.snapshotToken);

    // Single API instance for all devices
    this.api = new UfPapi();

    // Subscribe to connection events
    this.api.on(UfvConstants.EVENT_CONNECTION_ERROR, this._onConnectionError.bind(this));
    this.api.on(UfvConstants.EVENT_CONNECTION_CLOSED, this._onConnectionClosed.bind(this));

    // Subscribe to NVR events
    this.api.on(UfvConstants.EVENT_NVR_SERVER, this._onNvrServer.bind(this));

    // Subscribe to credentials updates
    Homey.ManagerSettings.on('set', key => {
      if (key === 'ufp:credentials') {
        this._login();
      }
    });
    this._login();

    this.log('UniFi Protect is running.');
  }

  _login() {
    this.log('Logging in...');

    // Validate NVR IP address
    const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
    if (!nvrip) {
      this.log('NVR IP address not set.');
      return;
    }

    // Validate NVR credentials
    const credentials = Homey.ManagerSettings.get('ufp:credentials');
    if (!credentials) {
      this.log('Credentials not set.');
      return;
    }

    // Log in to NVR
    this.api.login(nvrip, credentials.username, credentials.password)
      .then(() => {
         this.api.getBootstrapInfo()
           .then(() => {
             this.log('Bootstrap loaded.');
             this._checkMotion();
             this._motionLoop()
           })
           .catch(error => this.error(error));
         this.log('Logged in.');
      })
      .catch(error => this.error(error));
  }

  _checkMotion() {
    //Get Last Motion
    this.api.getMotionEvents()
      .then(motions => {
        motions.forEach(motion => {
          Homey.ManagerDrivers.getDriver('protectcamera').onParseTriggerMotionData(motion.camera, motion.start, motion.end, motion.thumbnail, motion.heatmap, motion.score);
        });
      })
      .catch(error => this.error(error));
  }

  _motionLoop() {
    setInterval(() => {
      this._checkMotion();
    }, 1000);
  }

  _onConnectionError(error) {
    this.log(`Connection error: ${error.message}, retrying in 5s...`);
    setTimeout(() => this._login(), 5000);
  }

  _onConnectionClosed() {
    this.log('Connection closed, retrying in 5s...');
    setTimeout(() => this._login(), 5000);
  }

  _onNvrServer(server) {
    Homey.ManagerDrivers.getDriver('unifiprotect').onServer(server);
  }
}

module.exports = UniFiProtect;
