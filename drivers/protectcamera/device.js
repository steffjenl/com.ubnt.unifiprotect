'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const UfvConstants = require('../../library/constants');

class Camera extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.waitForBootstrap();
    Homey.app.debug('UnifiCamera Device has been initialized');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    Homey.app.debug('UnifiCamera Device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    Homey.app.debug('UnifiCamera Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    Homey.app.debug('UnifiCamera Device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    Homey.app.debug('UnifiCamera Device has been deleted');
  }

  async initCamera() {
    this.camera = this.getData();
    this.device = this;

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
        .registerRunListener((args, state) => {
          if (typeof args.device.getData().id !== 'undefined') {
            this._onSnapshotBuffer(args.device.getData(), args.width)
                .catch(this.error.bind(this, 'Could not take snapshot.'));
          }

          return Promise.resolve(true);
        });

    // Action 'set recording mode'
    new Homey.FlowCardAction(UfvConstants.ACTION_SET_RECORDING_MODE)
        .register()
        .registerRunListener((args, state) => {
          if (typeof args.device.getData().id !== 'undefined') {
            Homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode)
                .then(Homey.app.debug.bind(this, '[recordingmode.set]'))
                .catch(this.error.bind(this, '[recordingmode.set]'));
          }

          return Promise.resolve(true);
        });

    this.registerCapabilityListener('camera_microphone_volume', async (value) => {
      Homey.app.debug('camera_microphone_volume');
      Homey.app.api.setMicVolume(this.camera, value)
          .catch(this.error);
    });

    await this._createSnapshotImage();
    await this._createMissingCapabilities();
    await this._initCameraData();
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

    // camera_nightvision_status
    if (!this.hasCapability('camera_nightvision_status')) {
      this.addCapability('camera_nightvision_status');
      Homey.app.debug(`created capability camera_nightvision_status for ${this.getName()}`);
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
    if (!this.hasCapability('last_ring_at')) {
      this.addCapability('last_ring_at');
      Homey.app.debug(`created capability last_ring_at for ${this.getName()}`);
    }
  }

  async _initCameraData() {
    const cameraData = Homey.app.api.getBootstrap();

    if (cameraData) {
      cameraData.cameras.forEach((camera) => {
        if (camera.id === this.camera.id) {

          if (this.hasCapability('camera_recording_status')) {
            this.setCapabilityValue('camera_recording_status', camera.isRecording);
          }
          if (this.hasCapability('camera_recording_mode')) {
            this.setCapabilityValue('camera_recording_mode',
                Homey.__(`events.camera.${String(camera.recordingSettings.mode)
                    .toLowerCase()}`));
          }
          if (this.hasCapability('camera_microphone_status')) {
            this.setCapabilityValue('camera_microphone_status', camera.isMicEnabled);
          }
          if (this.hasCapability('camera_nightvision_status')) {
            this.setCapabilityValue('camera_nightvision_status', camera.isDark);
          }
          if (this.hasCapability('camera_microphone_volume')) {
            this.setCapabilityValue('camera_microphone_volume', camera.micVolume);
          }
          if (this.hasCapability('camera_connection_status')) {
            if (this.getCapabilityValue('camera_connection_status') !== camera.isConnected) {
              this.onConnectionChanged(camera.isConnected);
            }
            this.setCapabilityValue('camera_connection_status', camera.isConnected);
          }

        }
      });
    }
  }

  onMotionStart() {
    Homey.app.debug('onMotionStart');
    this.setCapabilityValue('alarm_motion', true);
  }

  onMotionEnd() {
    Homey.app.debug('onMotionEnd');
    this.setCapabilityValue('alarm_motion', false);
  }

  onIsDark(isDark) {
    // Debug information about playload
    Homey.app.debug(JSON.stringify(isDark));
    if (this.hasCapability('camera_nightvision_status')) {
      this.setCapabilityValue('camera_nightvision_status', isDark);
    }
  }

  onDoorbellRinging(lastRing) {
    const lastRingAt = this.getCapabilityValue('last_ring_at');

    if (!lastRingAt) {
      if (Homey.env.DEBUG) Homey.app.debug(`set last_ring_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_ring_at', lastRing)
          .catch(this.error);
      return;
    }

    // Check if the event date is newer
    if (lastRing > lastRingAt) {
      this._doorbellRingingTrigger.trigger({
        ufp_ringing_camera: this.getName(),
      });
    }
  }

  onMotionDetected(lastMotionTime, isMotionDetected) {
    const lastMotionAt = this.getCapabilityValue('last_motion_at');

    if (!lastMotionAt) {
      Homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
      return;
    }

    // Check if the event date is newer
    if (isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = new Date(lastMotionTime);
      Homey.app.debug(`new motion detected on camera: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
      this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
          .catch(this.error);
      this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
          .catch(this.error);
      this.onMotionStart();
    } else if (!isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = new Date(lastMotionTime);
      Homey.app.debug(`motion detected ended on camera: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
      this.onMotionEnd();
      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
    }
  }

  onConnectionChanged(connectionStatus) {
    this._connectionStatusTrigger.trigger({
      ufp_connection_status: connectionStatus,
      ufp_connection_camera: this.getName(),
    });
  }

  onIsRecording(isRecording) {
    // Debug information about playload
    Homey.app.debug(JSON.stringify(isRecording));
    if (this.hasCapability('camera_recording_status')) {
      this.setCapabilityValue('camera_recording_status', isRecording);
    }
  }

  onIsMicEnabled(isMicEnabled) {
    // Debug information about playload
    Homey.app.debug(JSON.stringify(isMicEnabled));
    if (this.hasCapability('camera_microphone_status')) {
      this.setCapabilityValue('camera_microphone_status', isMicEnabled);
    }
  }

  onIsConnected(isConnected) {
    // Debug information about playload
    Homey.app.debug(JSON.stringify(isConnected));
    if (this.getCapabilityValue('camera_connection_status') !== isConnected) {
      this.onConnectionChanged(isConnected);
    }
    this.setCapabilityValue('camera_connection_status', isConnected);
  }

  onMicVolume(micVolume) {
    // Debug information about playload
    Homey.app.debug('micVolume');
    if (this.hasCapability('camera_microphone_volume')) {
      this.setCapabilityValue('camera_microphone_volume', micVolume);
    }
  }

  onRecordingMode(mode) {
    // Debug information about playload
    Homey.app.debug(JSON.stringify(mode));
    if (this.hasCapability('camera_recording_mode')) {
      this.setCapabilityValue('camera_recording_mode',
          Homey.__(`events.camera.${String(mode)
              .toLowerCase()}`));
    }
  }

  _onSnapshotBuffer(camera, width) {
    return new Promise((resolve, reject) => {
      Homey.app.api.createSnapshotUrl(camera, width)
          .then(snapshotUrl => {
            Homey.app.api.getStreamUrl(camera)
                .then(streamUrl => {
                  const SnapshotImage = new Homey.Image();
                  SnapshotImage.setStream(async stream => {
                    if (!snapshotUrl) {
                      throw new Error('Invalid snapshot url.');
                    }

                    const headers = {};

                    headers['Cookie'] = Homey.app.api.getProxyCookieToken();

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

                        Homey.app.debug('------ _onSnapshotBuffer ------');
                        Homey.app.debug(`- Camera name: ${this.getName()}`);
                        Homey.app.debug(`- Snapshot url: ${SnapshotImage.cloudUrl}`);
                        Homey.app.debug(`- Stream url: ${streamUrl}`);
                        Homey.app.debug('-------------------------------');

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
    Homey.app.debug('Creating snapshot image for camera ' + this.getName() + '.');

    this._snapshotImage = new Homey.Image();
    this._snapshotImage.setStream(async stream => {
      // Obtain snapshot URL
      let snapshotUrl = null;

      await Homey.app.api.createSnapshotUrl(this.camera)
          .then(url => {
            snapshotUrl = url;
          })
          .catch(this.error.bind(this, 'Could not create snapshot URL.'));

      if (!snapshotUrl) {
        throw new Error('Invalid snapshot url.');
      }

      const headers = {};
      headers['Cookie'] = Homey.app.api.getProxyCookieToken();

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

    Homey.app.debug('Created snapshot image for camera ' + this.getName() + '.');
  }

}

module.exports = Camera;
