'use strict';

const Homey = require('homey');

class UnifiProtect extends Homey.Device {
  onInit() {
    this.api = Homey.app.api;
    this.cameras = {};

    this.log('UniFi Cloud Key Pro driver initialized.');
    setInterval(() => {
      this._updateCapabilities();
    }, 300000);

  }

  onServer(server) {
    let totalSpaceUsed = ( ( (Number(server.storageInfo.totalSpaceUsed) / 1024 ) / 1024 ) / 1024 )
    let totalSize = ( ( (Number(server.storageInfo.totalSize) / 1024 ) / 1024 ) / 1000 )
    this.setCapabilityValue('nvr_disk_used', Math.round(Number(server.storageInfo.totalSpaceUsed)*100/Number(server.storageInfo.totalSize)));
    this.setCapabilityValue('nvr_disk_size', Math.round(totalSize));
    this.setCapabilityValue('nvr_disk_size_used', Math.round(totalSpaceUsed));
  }

  _updateCapabilities()
  {
    this.api.getServer().then(server => {
      let totalSpaceUsed = ( ( (Number(server.storageInfo.totalSpaceUsed) / 1024 ) / 1024 ) / 1024 )
      let totalSize = ( ( (Number(server.storageInfo.totalSize) / 1024 ) / 1024 ) / 1024 )
      this.setCapabilityValue('nvr_disk_used', Math.round(Number(server.storageInfo.totalSpaceUsed)*100/Number(server.storageInfo.totalSize)));
      this.setCapabilityValue('nvr_disk_size', Math.round(totalSize));
      this.setCapabilityValue('nvr_disk_size_used', Math.round(totalSpaceUsed));
    }).catch(error => this.error(error));
  }
}

module.exports = UnifiProtect;
