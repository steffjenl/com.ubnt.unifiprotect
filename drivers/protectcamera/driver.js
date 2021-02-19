'use strict';

const Homey = require('homey');

class UniFiCameraDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    Homey.app.debug('UnifiCamera Driver has been initialized');
  }

  onPair(socket) {
    // Validate NVR IP address
    socket.on('validate', (data, callback) => {
      const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
      callback(null, nvrip ? 'ok' : 'nok');
    });

    // Perform when device list is shown
    socket.on('list_devices', async (data, callback) => {
      callback(null, Object.values(await Homey.app.api.getCameras()).map(camera => {
        return {
          data: { id: String(camera.id) },
          name: camera.name,
        };
      }));
    });
  }

  getDeviceById(camera) {
    const device = this.getDevice({
      id: camera,
    });

    return device;
  }

  onParseWesocketMessage(camera, payload) {
    // Debug information about playload
    Homey.app.debug(JSON.stringify(payload));

    if (Object.prototype.hasOwnProperty.call(camera, '_events')) {
      if (payload.hasOwnProperty('isRecording')) {
        camera.onIsRecording(payload.isRecording);
      }

      if (payload.hasOwnProperty('isMicEnabled')) {
        camera.onIsMicEnabled(payload.isMicEnabled);
      }

      if (payload.hasOwnProperty('micVolume')) {
        camera.onMicVolume(payload.micVolume);
      }

      if (payload.hasOwnProperty('isConnected')) {
        camera.onIsConnected(payload.isConnected);
      }

      if (payload.hasOwnProperty('recordingSettings') && payload.recordingSettings.hasOwnProperty('mode')) {
        camera.onRecordingMode(payload.recordingSettings.mode);
      }

      if (payload.lastMotion) {
        camera.onMotionDetected(payload.lastMotion, payload.isMotionDetected);
      }

      if (payload.lastRing) {
        camera.onDoorbellRinging(payload.lastRing);
      }
    }
  }
}

module.exports = UniFiCameraDriver;
