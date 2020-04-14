'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const UfvConstants = require('../../lib/ufvconstants');

const Api = Homey.app.api;

class Camera extends Homey.Device {
  async onInit() {
    // this.camera = await this.getDriver().getCamera(this.getData().id).catch(this.error.bind(this, 'Could not get camera.'));
    this.camera = this.getData();

    // Snapshot trigger
    this._snapshotTrigger = new Homey.FlowCardTrigger(UfvConstants.EVENT_SNAPSHOT_CREATED);
    this._snapshotTrigger.register();

    // Action 'take snapshot'
    new Homey.FlowCardAction(UfvConstants.ACTION_TAKE_SNAPSHOT)
      .register()
      .registerRunListener((args, state) => { // eslint-disable-line no-unused-vars
        this._onSnapshotBuffer(this.camera)
          .catch(this.error.bind(this, 'Could not take snapshot.'));

        return Promise.resolve(true);
      });

    // Action 'set recording mode'
    new Homey.FlowCardAction(UfvConstants.ACTION_SET_RECORDING_MODE)
      .register()
      .registerRunListener((args, state) => { // eslint-disable-line no-unused-vars
        Api.setRecordingMode(args.device.getData(), args.recording_mode)
          .then(this.log.bind(this, '[recordingmode.set]'))
          .catch(this.error.bind(this, '[recordingmode.set]'));

        return Promise.resolve(true);
      });

    await this._createSnapshotImage();
    await this._createMissingCapabilities();
  }

  async _createMissingCapabilities() {
    if (!this.hasCapability("last_motion_score")) {
      this.addCapability("last_motion_score");
      this.log('created capability last_motion_score for ' + this.getName());
    }

    if (!this.hasCapability("last_motion_thumbnail")) {
      this.addCapability("last_motion_thumbnail");
      this.log('created capability last_motion_thumbnail for ' + this.getName());
    }
    if (!this.hasCapability("last_motion_heatmap")) {
      this.addCapability("last_motion_heatmap");
      this.log('created capability last_motion_heatmap for ' + this.getName());
    }
    if (!this.hasCapability("last_motion_datetime")) {
      this.addCapability("last_motion_datetime");
      this.log('created capability last_motion_datetime for ' + this.getName());
    }
  }

  _onSnapshotBuffer(camera) {
    return new Promise((resolve, reject) => {
      let snapshotUrl = null;
      let streamUrl = null;
      let thumbnailId = null;

      if (this.hasCapability("last_motion_thumbnail")) {
        thumbnailId = this.getCapabilityValue("last_motion_thumbnail");
      }

      Api.getCameraSnapshot(camera, thumbnailId)
        .then(address => {
          snapshotUrl = address
          Api.getStreamUrl(camera)
            .then(address => {
              streamUrl = address
              const SnapshotImage = new Homey.Image();
              SnapshotImage.setStream(async stream => {
                if (!snapshotUrl) {
                  throw new Error('Invalid snapshot url.');
                }

                const agent = new https.Agent({
                  rejectUnauthorized: false
                })

                // Fetch image
                const res = await fetch(snapshotUrl, { agent });
                if (!res.ok) throw new Error('Could not fetch snapshot image.');

                return res.body.pipe(stream);
              });
              SnapshotImage.register()
                .then(() => {
                  Homey.app.snapshotToken.setValue(SnapshotImage);

                  this.log('------ _onSnapshotBuffer ------');
                  this.log('- Camera name: ' + this.getName());
                  this.log('- thumbnail id: ' + thumbnailId);
                  this.log('- Snapshot url: ' + snapshotUrl);
                  this.log('- Stream url: ' + streamUrl);
                  this.log('-------------------------------');

                  this._snapshotTrigger.trigger({
                    ufv_snapshot_token: SnapshotImage,
                    ufv_snapshot_camera: this.getName(),
                    ufv_snapshot_snapshot_url: snapshotUrl,
                    ufv_snapshot_stream_url: streamUrl
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
    this.log('Creating snapshot image.');

    this._snapshotImage = new Homey.Image();
    this._snapshotImage.setStream(async stream => {
      // Obtain snapshot URL
      let snapshotUrl = null;

      await Api.createSnapshotUrl(this.camera)
        .then(url => { snapshotUrl = url; })
        .catch(this.error.bind(this, 'Could not create snapshot URL.'));

      if (!snapshotUrl) {
        throw new Error('Invalid snapshot url.');
      }

      const agent = new https.Agent({
        rejectUnauthorized: false
      })

      // Fetch image
      const res = await fetch(snapshotUrl, { agent });
      if (!res.ok) throw new Error('Could not fetch snapshot image.');

      return res.body.pipe(stream);
    });

    // Register snapshot and set camera image
    this._snapshotImage.register()
      .then(() => this.setCameraImage('snapshot', 'Snapshot', this._snapshotImage))
      .catch(this.error);

    this.log('Created snapshot image.');
  }

  onMotionStart() {
    this.log('onMotionStart');
    this.setCapabilityValue('alarm_motion', true);
  }

  onMotionEnd() {
    this.log('onMotionEnd');
    this.setCapabilityValue('alarm_motion', false);
  }

  onCamera(status) {
    this.log('onCamera');
    this.setCapabilityValue('camera_recording_status',
      Homey.__(`events.camera.${String(status.recordingIndicator).toLowerCase()}`));
  }

  onMotionDetected(start, end, motionThumbnail, motionHeatmap, motionScore) {
    const lastMotionAt = this.getCapabilityValue("last_motion_at");

    if (!lastMotionAt)
    {
      console.log("set last_motion_at to last datetime: " + this.getData().id);
      if (this.hasCapability("last_motion_at")) this.setCapabilityValue("last_motion_at", end).catch(this.error);
      //return;
    }

    //Check if the event date is newer
    if (start > lastMotionAt) {
      console.log("new motion detected on camera: " + this.getData().id);
      const lastMotion = new Date(start);
      if (this.hasCapability("last_motion_at")) this.setCapabilityValue("last_motion_at", start).catch(this.error);
      if (this.hasCapability("last_motion_score")) this.setCapabilityValue("last_motion_score", motionScore).catch(this.error);
      if (this.hasCapability("last_motion_thumbnail")) this.setCapabilityValue("last_motion_thumbnail", motionThumbnail).catch(this.error);
      if (this.hasCapability("last_motion_heatmap")) this.setCapabilityValue("last_motion_heatmap", motionHeatmap).catch(this.error);
      if (this.hasCapability("last_motion_datetime")) this.setCapabilityValue("last_motion_datetime", lastMotion.toLocaleDateString()).catch(this.error);
      this.onMotionStart();
      Api.setLastMotionAt(start);
    }
    else if (end > lastMotionAt) {
      this.onMotionEnd();
      if (this.hasCapability("last_motion_at")) this.setCapabilityValue("last_motion_at", end).catch(this.error);
      Api.setLastMotionAt(end);
    }
  }
}

module.exports = Camera;
