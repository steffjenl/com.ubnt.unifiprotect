'use strict';

const Homey = require('homey');

class Nvr extends Homey.Device {
  onHealth(health) {
    this.setCapabilityValue('nvr_health_status', Homey.__(`events.health.${String(health.status).toLowerCase()}`));
    this.setCapabilityValue('nvr_health_phrase', String(health.statusPhrase));
  }

  onServer(server) {
    this.setCapabilityValue('nvr_cpu_load', Math.round(Number(server.systemInfo.cpuLoad)));
    this.setCapabilityValue('nvr_disk_used', Math.round(Number(server.systemInfo.disk.usedPercent)));
  }
}

module.exports = Nvr;
