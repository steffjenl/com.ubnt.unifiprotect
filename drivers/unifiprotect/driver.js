'use strict';

const Homey = require('homey');
const UfvConstants = require('../../lib/ufvconstants');

class NvrDriver extends Homey.Driver {
  async onInit() {
    this.api = Homey.app.api;
    this.server = null;
    this.device = null;

    this.log('NVR driver initialized.');
  }

  onPair(socket) {
    this.log('onPair');

    // Create device from NVR server properties
    const createDevice = async credentials => {
      const nvrip = Homey.ManagerSettings.get('ufv:nvrip');
      this.log(nvrip);
      await this.api.login(nvrip, credentials.username, credentials.password);
      await this.api.getBootstrapInfo();
      this.server = await this.api.getServer();

      this.device = {
        name: this.server.name,
        data: { id: String(this.server.id) },
      };
      socket.showView('list_devices');
    };

    // Perform when view is changed
    socket.on('showView', (viewId, callback) => {
      this.log(`onShowView [${viewId}]`);

      if (viewId === 'login') {
        socket.emit('nvrip', Homey.ManagerSettings.get('ufv:nvrip'));
      }
      callback();
    });

    // Perform when user enters credentials in login screen
    socket.on('credentials', async (credentials, callback) => {
      this.log('onCredentials');

      // Store credentials in settings
      Homey.ManagerSettings.set('ufv:credentials', credentials);
      callback();

      createDevice(credentials);
    });

    // Perform when device list is shown
    socket.on('list_devices', (data, callback) => {
      callback(null, [this.device]);
    });

    // Perform when NVR is discovered
    this.api.on(UfvConstants.DEVICE_NVR, nvr => {
      this.log('onNvr');
      Homey.ManagerSettings.set('ufv:nvrip', nvr.ip);

      const credentials = Homey.ManagerSettings.get('ufv:credentials');
      if (credentials) {
        createDevice(credentials);
      } else {
        socket.showView('login');
      }
    });

    // Discover NVR
    this.api.discover();
  }

  async onHealth(health) {
    this.log('onHealth');

    if (!this.server) {
      this.server = await this.api.getServer();
    }
    const device = this.getDevice({ id: String(this.server._id) });
    if (device instanceof Error) return;

    device.onHealth(health);
  }

  async onServer(server) {
    this.log('onServer');

    if (!this.server) {
      this.server = await this.api.getServer();
    }
    const device = this.getDevice({ id: String(this.server._id) });
    if (device instanceof Error) return;

    device.onServer(server);
  }
}

module.exports = NvrDriver;
