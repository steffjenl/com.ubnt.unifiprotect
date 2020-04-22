// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');

class CameraDriver extends Homey.Driver {
  onInit() {
    this.api = Homey.app.api;
    this.cameras = {};

    this.log('Camera driver initialized.');
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

  async getCamera(id) {
    if (Object.keys(this.cameras).length === 0) {
      this.log('Obtaining cameras from API...');
      const result = await this.api.getCameras();

      Object.values(result).forEach(camera => {
        this.log(`Adding camera [${camera.id}]`);
        this.cameras[camera.id] = camera;
      });
      this.log('Finished obtaining cameras from API.');
    }
    this.log(`Found [${this.cameras[id].name}]`);

    return this.cameras[id];
  }

  onMotion(motion) {
    const device = this.getDevice({ id: String(motion.cameraId) });
    if (device instanceof Error) return;

    if (motion.endTime === 0) {
      device.onMotionStart();
    } else {
      device.onMotionEnd();
    }
  }

  onCamera(camera) {
    const device = this.getDevice({ id: String(camera.id) });
    if (device instanceof Error) return;

    const status = {
      recordingIndicator: camera.isRecording,
    };
    device.onCamera(status);
  }

  onParseTriggerMotionData(camera, motionStart, motionEnd, motionThumbnail, motionHeatmap, motionScore) {
    const device = this.getDevice({
      id: camera,
    });

    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onMotionDetected(motionStart, motionEnd, motionThumbnail, motionHeatmap, motionScore);
    } else {
      this.log(`Unknown device: ${camera}`);
    }
  }

  onParseTriggerCameraData(cameraData) {
    const device = this.getDevice({
      id: cameraData.id,
    });

    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onRefreshCamera(cameraData);
    } else {
      this.log(`Unknown device: ${cameraData.id}`);
    }
  }
}

module.exports = CameraDriver;
