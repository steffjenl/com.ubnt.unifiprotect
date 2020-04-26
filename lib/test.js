/* eslint-disable no-console */

'use strict';

const UfvApi = require('./ufvapi');
const UfvConstants = require('./ufvconstants');

const log = msg => {
  const t = new Date().toLocaleTimeString();
  console.info(`[${t}] ${msg}`);
};

const api = new UfvApi();

api.on(UfvConstants.EVENT_CONNECTION_KEEPALIVE, () => {
  log('CONNECTION KEEPALIVE');
});

api.on(UfvConstants.EVENT_CONNECTION_CLOSED, () => {
  log('CONNECTION CLOSED; retrying in 5s...');
  setTimeout(api.subscribe, 5000);
});

api.on(UfvConstants.EVENT_CONNECTION_ERROR, error => {
  log(`CONNECTION ERROR: ${error.message}`);
});

api.on(UfvConstants.EVENT_NVR_CAMERA, camera => {
  log(`CAMERA: name=[${camera.name}], recordingIndicator=[${camera.recordingIndicator}]`);
});

api.on(UfvConstants.EVENT_NVR_HEALTH, health => {
  log(`HEALTH: status=[${health.status}], statusPhrase=[${health.statusPhrase}]`);
});

api.on(UfvConstants.EVENT_NVR_MOTION, motion => {
  if (motion.endTime === 0) {
    log(`MOTION STARTED: cameraId=[${motion.cameraId}]`);
  } else {
    log(`MOTION ENDED: cameraId=[${motion.cameraId}]`);
  }
});

api.on(UfvConstants.EVENT_NVR_RECORDING, recording => {
  log(`RECORDING: eventType=[${recording.eventType}], cameraName=[${recording.meta.cameraName}]`);
});

api.on(UfvConstants.EVENT_NVR_SERVER, server => {
  log(`SERVER: cpuLoad=[${server.systemInfo.cpuLoad}], usedPercent=[${server.systemInfo.disk.usedPercent}]`);
});

api.on(UfvConstants.EVENT_NVR_OTHER, other => {
  log(`OTHER: ${JSON.stringify(other, null, 2)}]`);
});

// eslint-disable-next-line no-unused-vars
api.on(UfvConstants.DEVICE_NVR, nvr => {
  api.loginProxy('10.0.0.1', 'Beheerder', 'P@ssw0rd')
    .then(() => {
      api.subscribe();
      api.getBootstrapInfo()
        .then(() => {
          api.getCameras()
            .then(cameras => {
              cameras.forEach(camera => {
                log(camera.name);
                log(camera.mac);
                log(camera.id);
                log('------------------------');
              });
            })
            .catch(error => console.error(error));
        });
    })
    .catch(error => console.error(error));
});

api.discover();
