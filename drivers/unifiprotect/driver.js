// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');
const UfvConstants = require('../../lib/ufvconstants');

class NvrDriver extends Homey.Driver {
  async onInit() {
    this.api = Homey.app.api;
    this.server = null;
    this.device = null;

    this.log('NVR driver initialized.');

    await this.api.getServer().then(serverInfo => {
      this.device = {
        name: serverInfo.name,
        data: { id: String(serverInfo.id) },
      };
    });
  }

  onPair(socket) {
    this.log('onPair');
    // Validate NVR IP address
    socket.on('validate', (data, callback) => {
      const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
      callback(null, nvrip ? 'ok' : 'nok');
    });

    // // Create device from NVR server properties
    // const createDevice = async credentials => {
    //   await this.api.getServer().then(serverInfo => {
    //     this.device = {
    //       name: serverInfo.name,
    //       data: { id: String(serverInfo.id) },
    //     };
    //     socket.showView('list_devices');
    //     }
    //   );
    // };

    // Perform when view is changed
    socket.on('showView', (viewId, callback) => {
      this.log(`onShowView [${viewId}]`);

      if (viewId === 'login') {
        socket.emit('nvrip', Homey.ManagerSettings.get('ufp:nvrip'));
      }
      callback();
    });

    // // Perform when user enters credentials in login screen
    // socket.on('credentials', async (credentials, callback) => {
    //   this.log('onCredentials');
    //
    //   // Store credentials in settings
    //   Homey.ManagerSettings.set('ufp:credentials', credentials);
    //   callback();
    //
    //   createDevice(credentials);
    // });

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

    // Discover NVR
    // this.api.discover();
  }

  async onServer(server) {
    this.log('onServer');

    if (!this.server) {
      this.server = await this.api.getServer();
    }
    const device = this.getDevice({ id: String(this.server.id) });
    if (device instanceof Error) return;

    device.onServer(server);
  }
}

module.exports = NvrDriver;
