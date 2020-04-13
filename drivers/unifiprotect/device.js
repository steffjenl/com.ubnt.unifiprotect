'use strict';

const Homey = require('homey');

class UnifiProtect extends Homey.Device {
  onServer(server) {
    let totalSpaceUsed = ( ( (Number(server.storageInfo.totalSpaceUsed) / 1000 ) / 1000 ) / 1000 )
    let totalSize = ( ( (Number(server.storageInfo.totalSize) / 1000 ) / 1000 ) / 1000 )
    this.setCapabilityValue('nvr_disk_used', Math.round(Number(server.storageInfo.totalSpaceUsed)*100/Number(server.storageInfo.totalSize)));
    this.setCapabilityValue('nvr_disk_size', Math.round(totalSize));
    this.setCapabilityValue('nvr_disk_size_used', Math.round(totalSpaceUsed));
  }
}

module.exports = UnifiProtect;
