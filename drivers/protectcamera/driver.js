// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');

class CameraDriver extends Homey.Driver {
  onInit() {
    this.api = Homey.app.api;
    this.cameras = {};

    Homey.app.debug('Camera driver initialized.');
  }

  onPair(socket) {
    // Validate NVR IP address
    socket.on('validate', (data, callback) => {
      const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
      callback(null, nvrip ? 'ok' : 'nok');
    });

    // Perform when device list is shown
    socket.on('list_devices', async (data, callback) => {
      callback(null, Object.values(await this.api.getCameras()).map(camera => {
        return {
          data: { id: String(camera.id) },
          name: camera.name,
        };
      }));
    });
  }

  getDeviceById(camera)
  {
    const device = this.getDevice({
      id: camera,
    });

    return device;
  }

  onParseWebsocketMotionData(device, lastMotion, isMotionDetected)
  {
    Homey.app.debug("Lastmotion from Websockets " + lastMotion);
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onMotionDetectedWS(lastMotion, isMotionDetected);
    }
  }
  onParseWebsocketLastRingData(device, lastRing)
  {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onDoorbellRinging(lastRing);
    }
  }

  onParseTriggerCameraEvents(cameraEvent) {
    const device = this.getDevice({
      id: cameraEvent.camera,
    });

    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onRefreshMotionData(cameraEvent.start, cameraEvent.end, cameraEvent.thumbnail, cameraEvent.heatmap, cameraEvent.score);
    }
  }

  onParseTriggerCameraData(cameraData) {
    const device = this.getDevice({
      id: cameraData.id,
    });

    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onRefreshCamera(cameraData);
    }
  }
}

module.exports = CameraDriver;
