// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');
const UfPapi = require('./lib/ufpapi');
const UfvConstants = require('./lib/ufvconstants');

class UniFiProtect extends Homey.App {
  async onInit() {
    this.loggedIn = false;
    this.useProxy = false;

    this.nvrIp = false;
    this.nvrUsername = false;
    this.nvrPassword = false;

    // Register snapshot image token
    this.snapshotToken = new Homey.FlowToken('ufv_snapshot', {
      type: 'image',
      title: 'Snapshot',
    });
    Homey.ManagerFlow.registerToken(this.snapshotToken);

    // Single API instance for all devices
    this.api = new UfPapi();

    // Subscribe to credentials updates
    Homey.ManagerSettings.on('set', key => {
      if (key === 'ufp:credentials') {
        this._login();
      }
    });
    this._login();

    this._checkMotion();
    this._refreshCapabilities();
    this._refreshCookie();

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

    // Setting NVR Port when set
    const nvrport = Homey.ManagerSettings.get('ufp:nvrport');
    if (nvrport) {
      this.api.setApiPort(nvrport);
    }

    // Validate NVR credentials
    const credentials = Homey.ManagerSettings.get('ufp:credentials');
    if (!credentials) {
      this.log('Credentials not set.');
      return;
    }

    // Validate NVR IP address
    const nvrUseProxy = Homey.ManagerSettings.get('ufp:useproxy');

    if (nvrUseProxy === 'true') {
      this.api.setApiPort(443);
      // Log in to NVR
      this.api.loginProxy(nvrip, credentials.username, credentials.password)
        .then(() => {
          this.api.getBootstrapInfo()
            .then(() => {
              this.log('Bootstrap loaded.');
              this.loggedIn = true;
              this.useProxy = true;

              this.nvrIp = nvrip;
              this.nvrUsername = credentials.username;
              this.nvrPassword = credentials.password;
            })
            .catch(error => this.error(error));
          this.log('Logged in.');
        })
        .catch(error => this.error(error));
    }
    else {
      // Log in to NVR
      this.api.login(nvrip, credentials.username, credentials.password)
        .then(() => {
          this.api.getBootstrapInfo()
            .then(() => {
              this.log('Bootstrap loaded.');
              this.loggedIn = true;
            })
            .catch(error => this.error(error));
          this.log('Logged in.');
        })
        .catch(error => this.error(error));
    }
  }

  _checkMotion() {
    if (this.loggedIn) {
      // Get Last Motion
      this.api.getMotionEvents()
        .then(motions => {
          motions.forEach(motion => {
            Homey.ManagerDrivers.getDriver('protectcamera')
              .onParseTriggerMotionData(motion.camera, motion.start, motion.end, motion.thumbnail, motion.heatmap, motion.score);
          });
        })
        .catch(error => this.error(error));
    }
    // _checkMotion after 1 second
    setTimeout(() => {
      this._checkMotion();
    }, 1000);
  }

  _refreshCapabilities() {
    if (this.loggedIn) {
      this.api.getCameras()
        .then(cameras => {
          cameras.forEach(camera => {
            Homey.ManagerDrivers.getDriver('protectcamera')
              .onParseTriggerCameraData(camera);
          });
        })
        .catch(error => this.error(error));
    }
    // _refreshCapabilities after 5 second
    setTimeout(() => {
      this._refreshCapabilities();
    }, 5000);
  }

  _refreshCookie() {
    if (this.loggedIn && this.useProxy) {

      this.api.loginProxy(this.nvrIp, this.nvrUsername, this.nvrPassword)
        .then(() => {
          this.log('Logged in again to refresh cookie.');
        })
        .catch(error => this.error(error));
    }
    // _refreshCookie after 6 hours
    setTimeout(() => {
      this._refreshCookie();
    }, 2700000);
  }
}

module.exports = UniFiProtect;
