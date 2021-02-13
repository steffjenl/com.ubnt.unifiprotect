// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const UfvConstants = require('../../lib/ufvconstants');

const Api = Homey.app.api;

class Camera extends Homey.Device {
  async onInit() {
    await this.waitForBootstrap();
  }

  async initCamera() {
    if (Homey.env.DEBUG) Homey.app.debug('Init camera ' + this.getName());
    this.camera = this.getData();

    // Snapshot trigger
    this._snapshotTrigger = new Homey.FlowCardTrigger(UfvConstants.EVENT_SNAPSHOT_CREATED);
    this._snapshotTrigger.register();

    // Connection Status trigger
    this._connectionStatusTrigger = new Homey.FlowCardTrigger(UfvConstants.EVENT_CONNECTION_CHANGED);
    this._connectionStatusTrigger.register();

    // Connection Status trigger
    this._doorbellRingingTrigger = new Homey.FlowCardTrigger(UfvConstants.EVENT_DOORBELL_RINGING);
    this._doorbellRingingTrigger.register();

    // Action 'take snapshot'
    new Homey.FlowCardAction(UfvConstants.ACTION_TAKE_SNAPSHOT)
      .register()
      .registerRunListener((args, state) => { // eslint-disable-line no-unused-vars
        this._onSnapshotBuffer(this.camera, args.width)
          .catch(this.error.bind(this, 'Could not take snapshot.'));

        return Promise.resolve(true);
      });

    // Action 'set recording mode'
    new Homey.FlowCardAction(UfvConstants.ACTION_SET_RECORDING_MODE)
      .register()
      .registerRunListener((args, state) => { // eslint-disable-line no-unused-vars
        Api.setRecordingMode(args.device.getData(), args.recording_mode)
          .then(Homey.app.debug.bind(this, '[recordingmode.set]'))
          .catch(this.error.bind(this, '[recordingmode.set]'));

        return Promise.resolve(true);
      });

    this.registerCapabilityListener('camera_microphone_volume', async (value) => {
      Api.setMicVolume(this.camera, value)
        .catch(this.error);
    });

    await this._createSnapshotImage();
    await this._createMissingCapabilities();
  }

  async waitForBootstrap() {
    if (typeof Homey.app.api.getLastUpdateId() !== 'undefined' && Homey.app.api.getLastUpdateId() !== null) {
      await this.initCamera();
    } else {
      setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'camera') {
      Homey.app.debug(`changed class to camera for ${this.getName()}`);
      this.setClass('camera');
    }

    if (!this.hasCapability('last_motion_score')) {
      this.addCapability('last_motion_score');
      Homey.app.debug(`created capability last_motion_score for ${this.getName()}`);
    }

    if (!this.hasCapability('last_motion_thumbnail')) {
      this.addCapability('last_motion_thumbnail');
      Homey.app.debug(`created capability last_motion_thumbnail for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_heatmap')) {
      this.addCapability('last_motion_heatmap');
      Homey.app.debug(`created capability last_motion_heatmap for ${this.getName()}`);
    }
    if (this.hasCapability('last_motion_datetime')) {
      this.removeCapability('last_motion_datetime');
      Homey.app.debug(`removed capability last_motion_datetime for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_date')) {
      this.addCapability('last_motion_date');
      Homey.app.debug(`created capability last_motion_date for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_time')) {
      this.addCapability('last_motion_time');
      Homey.app.debug(`created capability last_motion_time for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_recording_mode')) {
      this.addCapability('camera_recording_mode');
      Homey.app.debug(`created capability camera_recording_mode for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_microphone_status')) {
      this.addCapability('camera_microphone_status');
      Homey.app.debug(`created capability camera_microphone_status for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_microphone_volume')) {
      this.addCapability('camera_microphone_volume');
      Homey.app.debug(`created capability camera_microphone_volume for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_connection_status')) {
      this.addCapability('camera_connection_status');
      Homey.app.debug(`created capability camera_connection_status for ${this.getName()}`);
    }
  }

  _onSnapshotBuffer(camera, width) {
    return new Promise((resolve, reject) => {
      const snapshotUrl = null;
      const streamUrl = null;

      Api.createSnapshotUrl(camera, width)
        .then(snapshotUrl => {
          Api.getStreamUrl(camera)
            .then(streamUrl => {
              const SnapshotImage = new Homey.Image();
              SnapshotImage.setStream(async stream => {
                if (!snapshotUrl) {
                  throw new Error('Invalid snapshot url.');
                }

                const headers = {};

                headers['Cookie'] = Api.getProxyCookieToken();

                const agent = new https.Agent({
                  rejectUnauthorized: false,
                  keepAlive: false,
                });

                // Fetch image
                const res = await fetch(snapshotUrl, {
                  agent,
                  headers
                });
                if (!res.ok) throw new Error('Could not fetch snapshot image.');

                return res.body.pipe(stream);
              });
              SnapshotImage.register()
                .then(() => {
                  Homey.app.snapshotToken.setValue(SnapshotImage);

                  if (Homey.env.DEBUG) Homey.app.debug('------ _onSnapshotBuffer ------');
                  if (Homey.env.DEBUG) Homey.app.debug(`- Camera name: ${this.getName()}`);
                  if (Homey.env.DEBUG) Homey.app.debug(`- Snapshot url: ${SnapshotImage.cloudUrl}`);
                  if (Homey.env.DEBUG) Homey.app.debug(`- Stream url: ${streamUrl}`);
                  if (Homey.env.DEBUG) Homey.app.debug('-------------------------------');

                  this._snapshotTrigger.trigger({
                    ufv_snapshot_token: SnapshotImage,
                    ufv_snapshot_camera: this.getName(),
                    ufv_snapshot_snapshot_url: SnapshotImage.cloudUrl,
                    ufv_snapshot_stream_url: streamUrl,
                  });
                })
                .catch(error => reject(error));
            })
            .catch(error => reject(error));
        })
        .catch(error => reject(error));
    });
  }

  async _createSnapshotImage() {
    if (Homey.env.DEBUG) Homey.app.debug('Creating snapshot image for camera ' + this.getName() + '.');

    this._snapshotImage = new Homey.Image();
    this._snapshotImage.setStream(async stream => {
      // Obtain snapshot URL
      let snapshotUrl = null;

      await Api.createSnapshotUrl(this.camera)
        .then(url => {
          snapshotUrl = url;
        })
        .catch(this.error.bind(this, 'Could not create snapshot URL.'));

      if (!snapshotUrl) {
        throw new Error('Invalid snapshot url.');
      }

      const headers = {};
      headers['Cookie'] = Api.getProxyCookieToken();

      const agent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: false,
      });

      // Fetch image
      const res = await fetch(snapshotUrl, {
        agent,
        headers
      });
      if (!res.ok) throw new Error('Could not fetch snapshot image.');

      return res.body.pipe(stream);
    });

    // Register snapshot and set camera image
    this._snapshotImage.register()
      .then(() => this.setCameraImage('snapshot', 'Snapshot', this._snapshotImage))
      .catch(this.error);

    if (Homey.env.DEBUG) Homey.app.debug('Created snapshot image for camera ' + this.getName() + '.');
  }

  onMotionStart() {
    Homey.app.debug('onMotionStart');
    this.setCapabilityValue('alarm_motion', true);
  }

  onMotionEnd() {
    Homey.app.debug('onMotionEnd');
    this.setCapabilityValue('alarm_motion', false);
  }

  onConnectionChanged(connectionStatus) {
    this._connectionStatusTrigger.trigger({
      ufp_connection_status: connectionStatus,
      ufp_connection_camera: this.getName(),
    });
  }

  onCamera(status) {
    Homey.app.debug('onCamera');
    this.setCapabilityValue('camera_recording_status',
      Homey.__(`events.camera.${String(status.recordingIndicator)
        .toLowerCase()}`));
  }

  onDoorbellRinging(lastRing) {
    this._doorbellRingingTrigger.trigger({
      ufp_ringing_camera: this.getName(),
    });
  }

  onMotionDetectedWS(lastMotionTime, isMotionDetected) {
    const lastMotionAt = this.getCapabilityValue('last_motion_at');

    if (!lastMotionAt) {
      if (Homey.env.DEBUG) Homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
      return;
    }

    // Check if the event date is newer
    if (isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = new Date(lastMotionTime);
      if (Homey.env.DEBUG) Homey.app.debug(`new motion detected on camera: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
      this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
        .catch(this.error);
      this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
        .catch(this.error);
      this.onMotionStart();
      Api.setLastMotionAt(lastMotionTime);
    } else if (!isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = new Date(lastMotionTime);
      if (Homey.env.DEBUG) Homey.app.debug(`motion detected ended on camera: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
      this.onMotionEnd();
      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
      Api.setLastMotionAt(lastMotionTime);
    }
  }

  onRefreshMotionData(start, end, motionThumbnail, motionHeatmap, motionScore) {
    this.setCapabilityValue('last_motion_score', Number(motionScore))
      .catch(this.error);
    this.setCapabilityValue('last_motion_thumbnail', motionThumbnail)
      .catch(this.error);
    this.setCapabilityValue('last_motion_heatmap', motionHeatmap)
      .catch(this.error);
  }

  onRefreshCamera(cameraData) {
    if (this.hasCapability('camera_recording_status')) {
      this.setCapabilityValue('camera_recording_status', cameraData.isRecording);
    }
    if (this.hasCapability('camera_recording_mode')) {
      this.setCapabilityValue('camera_recording_mode',
        Homey.__(`events.camera.${String(cameraData.recordingSettings.mode)
          .toLowerCase()}`));
    }
    if (this.hasCapability('camera_microphone_status')) {
      this.setCapabilityValue('camera_microphone_status', cameraData.isMicEnabled);
    }
    if (this.hasCapability('camera_microphone_volume')) {
      this.setCapabilityValue('camera_microphone_volume', cameraData.micVolume);
    }
    if (this.hasCapability('camera_connection_status')) {
      if (this.getCapabilityValue('camera_connection_status') !== cameraData.isConnected) {
        this.onConnectionChanged(cameraData.isConnected);
      }
      this.setCapabilityValue('camera_connection_status', cameraData.isConnected);
    }
  }
}

module.exports = Camera;
