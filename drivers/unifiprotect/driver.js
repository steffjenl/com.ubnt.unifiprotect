// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');
const UfvConstants = require('../../lib/ufvconstants');

class NvrDriver extends Homey.Driver {
  async onInit() {
    this.api = Homey.app.api;
    this.device = null;

    this.log('NVR driver initialized.');
  }

  onPair(socket) {
    this.log('onPair');
    // Validate NVR IP address
    socket.on('validate', (data, callback) => {
      const nvrip = Homey.ManagerSettings.get('ufp:nvrip');

      if (nvrip) {
        this.api.getServer()
          .then(serverInfo => {
            this.device = {
              name: serverInfo.name,
              data: { id: String(serverInfo.id) },
            };
          });
      }

      callback(null, nvrip ? 'ok' : 'nok');
    });

    // Perform when view is changed
    socket.on('showView', (viewId, callback) => {
      this.log(`onShowView [${viewId}]`);

      if (viewId === 'login') {
        socket.emit('nvrip', Homey.ManagerSettings.get('ufp:nvrip'));
      }
      callback();
    });

    // Perform when device list is shown
    socket.on('list_devices', (data, callback) => {
      callback(null, [this.device]);
    });

    // Perform when NVR is discovered
    this.api.on(UfvConstants.DEVICE_NVR, nvr => {
      this.log('onNvr');
      Homey.ManagerSettings.set('ufp:nvrip', nvr.ip);

      const credentials = Homey.ManagerSettings.get('ufp:credentials');
      if (credentials) {
        createDevice(credentials);
      } else {
        socket.showView('login');
      }
    });
  }
}

module.exports = NvrDriver;
