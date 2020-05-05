// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');

class UnifiProtect extends Homey.Device {
  onInit() {
    this.api = Homey.app.api;
    this.cameras = {};

    this.log('UniFi Cloud Key Pro driver initialized.');
    this._updateCapabilities();
  }

  _updateCapabilities() {
    this.api.getServer().then(server => {
      const totalSpaceUsed = (((Number(server.storageInfo.totalSpaceUsed) / 1024) / 1024) / 1024);
      const totalSize = (((Number(server.storageInfo.totalSize) / 1024) / 1024) / 1024);
      this.setCapabilityValue('nvr_disk_used', Math.round(Number(server.storageInfo.totalSpaceUsed) * 100 / Number(server.storageInfo.totalSize)));
      this.setCapabilityValue('nvr_disk_size', Math.round(totalSize));
      this.setCapabilityValue('nvr_disk_size_used', Math.round(totalSpaceUsed));
    }).catch(error => this.error(error));

    // _updateCapabilities after 5 second
    const timeOutFunction = function () {
      this._updateCapabilities();
    }.bind(this);
    setTimeout(timeOutFunction, 300000);
  }
}

module.exports = UnifiProtect;
