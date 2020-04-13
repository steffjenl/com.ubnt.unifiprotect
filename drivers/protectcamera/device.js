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
        Api.snapshot(args.device.getData().id, args.width)
          .then(buffer => this._onSnapshotBuffer(this.camera, buffer))
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
  }

  _onSnapshotBuffer(camera, buffer) {
    const img = new Homey.Image('jpg');
    const snapshotUrl = Api.getSnapShotUrl(camera);
    const streamUrl = Api.getStreamUrl(camera);

    img.setBuffer(buffer);
    img.register()
      .then(() => {
        Homey.app.snapshotToken.setValue(img);

        this._snapshotTrigger.trigger({
          ufv_snapshot_token: img,
          ufv_snapshot_camera: this.getName(),
          ufv_snapshot_snapshot_url: snapshotUrl,
          ufv_snapshot_stream_url: streamUrl
        });
      })
      .catch(this.error.bind(this, '[snapshot.register]'));
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

  _triggerSnapshotflow()
  {
    // Action 'take snapshot'
    new Homey.FlowCardAction(UfvConstants.ACTION_TAKE_SNAPSHOT)
      .register()
      .registerRunListener((args, state) => { // eslint-disable-line no-unused-vars
        Api.snapshot(args.device.getData().id, args.width)
          .then(buffer => this._onSnapshotBuffer(this.camera, buffer))
          .catch(this.error.bind(this, 'Could not take snapshot.'));

        return Promise.resolve(true);
      });
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

  onMotionDetected(start, end) {
    let lastMotionAt = this.getCapabilityValue("last_motion_at");
    //Check if the event date is newer
    if (start > lastMotionAt) {
      console.log("new motion detected on camera: " + this.getData().id);
      this.setCapabilityValue("last_motion_at", start).catch(this.log);
      this.onMotionStart();
      Api.setLastMotionAt(start);
      this._triggerSnapshotflow();
    }
    else if (end > lastMotionAt) {
      this.onMotionEnd();
      this.setCapabilityValue("last_motion_at", end).catch(this.log);
      Api.setLastMotionAt(end);
    }
  }
}

module.exports = Camera;
