'use strict';

const Homey = require('homey');
const UfvApi = require('./lib/ufvapi');
const UfvConstants = require('./lib/ufvconstants');

class UniFiVideo extends Homey.App {
  async onInit() {
    // Register snapshot image token
    this.snapshotToken = new Homey.FlowToken('ufv_snapshot', {
      type: 'image',
      title: 'Snapshot',
    });
    Homey.ManagerFlow.registerToken(this.snapshotToken);

    // Single API instance for all devices
    this.api = new UfvApi();

    // Subscribe to connection events
    this.api.on(UfvConstants.EVENT_CONNECTION_ERROR, this._onConnectionError.bind(this));
    this.api.on(UfvConstants.EVENT_CONNECTION_CLOSED, this._onConnectionClosed.bind(this));

    // Subscribe to NVR events
    this.api.on(UfvConstants.EVENT_NVR_CAMERA, this._onNvrCamera.bind(this));
    this.api.on(UfvConstants.EVENT_NVR_HEALTH, this._onNvrHealth.bind(this));
    this.api.on(UfvConstants.EVENT_NVR_MOTION, this._onNvrMotion.bind(this));
    this.api.on(UfvConstants.EVENT_NVR_SERVER, this._onNvrServer.bind(this));

    // Subscribe to credentials updates
    Homey.ManagerSettings.on('set', key => {
      if (key === 'ufv:credentials') {
        this._login();
      }
    });
    this._login();


    // Enable remote debugging, if applicable
    if (Homey.env.DEBUG) {
      // eslint-disable-next-line global-require
      require('inspector').open(9229, '0.0.0.0');
    }
    this.log('UniFi Protect is running.');
  }

  _login() {
    this.log('Logging in...');

    // Validate NVR IP address
    const nvrip = Homey.ManagerSettings.get('ufv:nvrip');
    if (!nvrip) {
      this.log('NVR IP address not set.');
      return;
    }

    // Validate NVR credentials
    const credentials = Homey.ManagerSettings.get('ufv:credentials');
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
            this._refreshTokens();
            this._checkMotion();
            this._motionLoop()
          })
          .catch(error => this.log(error));
        this.log('Logged in.');
      })
      .catch(error => this.log(error));


  }

  _refreshBootstrap() {
    this.api.getBootstrapInfo()
      .then(() => {
        this.log('Bootstrap loaded.');
      })
      .catch(error => this.log(error));
  }

  _refreshTokens() {
    // setInterval(() => this._login(), 604800000);
    //setInterval(() => this._refreshBootstrap(), 3600000);
  }

  _checkMotion() {
    //Get Last Motion
    this.api.getMotionEvents()
      .then(motions => {
        motions.forEach(motion => {
          Homey.ManagerDrivers.getDriver('camera').onParseTriggerData(motion.camera, motion.start, motion.end);
        });
      })
      .catch(error => this.log(error));
  }

  _motionLoop() {
    setInterval(() => {
      this._checkMotion();
    }, 5000);
  }

  _onConnectionError(error) {
    this.log(`Connection error: ${error.message}, retrying in 5s...`);
    setTimeout(() => this._login(), 5000);
  }

  _onConnectionClosed() {
    this.log('Connection closed, retrying in 5s...');
    setTimeout(() => this._login(), 5000);
  }

  _onNvrCamera(camera) {
    Homey.ManagerDrivers.getDriver('camera').onCamera(camera);
  }

  _onNvrHealth(health) {
    Homey.ManagerDrivers.getDriver('nvr').onHealth(health);
  }

  _onNvrMotion(motion) {
    Homey.ManagerDrivers.getDriver('camera').onMotion(motion);
  }

  _onNvrServer(server) {
    Homey.ManagerDrivers.getDriver('nvr').onServer(server);
  }
}

module.exports = UniFiVideo;
