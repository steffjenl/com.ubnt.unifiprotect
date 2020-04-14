/* eslint-disable no-console */

'use strict';
const Homey = require('homey');
const https = require('https');
const { EventEmitter } = require('events');
const UfvDiscovery = require('./ufvdiscovery');
const UfvConstants = require('./ufvconstants');

const UFV_API_ENDPOINT = '/api';
const UFV_API_PORT = 7443;

class UfPapi extends EventEmitter {
  constructor() {
    super();
    this._apikey = null;
    this._authorization = null;
    this._lastMotionAt = null;
    this._rtspPort = null;
  }

  setLastMotionAt(lastMotionAt) {
    this._lastMotionAt = lastMotionAt;
    return this;
  }

  getApiKey()
  {
    return this._apikey;
  }

  getHost()
  {
    return this._host;
  }

  _download(resource, params) {
    return this._get(resource, params, true);
  }

  getStreamUrl(camera) {
    return new Promise((resolve, reject) => {
      let rtspAlias = null;

      this.findCameraById(camera.id)
        .then(cameraInfo => {
          cameraInfo.channels.forEach(channel => {
            if (channel.isRtspEnabled) {
              rtspAlias = channel.rtspAlias;
            }
          });

          if (!rtspAlias) {
            reject('no rtsp alias found!');
          }

          resolve( `rtsp://${this.getHost()}:${this._rtspPort}/${rtspAlias}` );
        })
        .catch(error => reject(new Error(`Error getting steam url: ${error}`)));
    });
  }

  getCameraSnapshot(camera, thumbnailId, widthInPixels) {
    return new Promise((resolve, reject) => {
      if (!thumbnailId)
      {
        this.getSnapShotUrl(camera, widthInPixels).then( url => { resolve(url)} );
      }
      else
      {
        this.getThumbnailUrl(thumbnailId, widthInPixels).then( url => { resolve(url)} );
      }
    });
  }

  getThumbnailUrl(thumbnailId, widthInPixels = 1920) {
    return new Promise((resolve, reject) => {
      const height = widthInPixels / 16 * 9;

      const params = {
        accessKey: this.getApiKey(),
        w: widthInPixels,
        h: height
      };

      resolve( `https://${this.getHost()}:${UFV_API_PORT}${UFV_API_ENDPOINT}/thumbnails/${thumbnailId}${this._toQueryString(params)}`);
    });
  }

  getSnapShotUrl(camera, widthInPixels = 1920) {
    return new Promise((resolve, reject) => {
      let height = widthInPixels / 16 * 9;

      const params = {
        accessKey: this.getApiKey(),
        w: widthInPixels,
        h: height
      };

      resolve( `https://${this.getHost()}:${UFV_API_PORT}${UFV_API_ENDPOINT}/cameras/${camera.id}/snapshot${this._toQueryString(params)}`);
    });
  }

  _get(resource, params = {}, isBinary = false) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization) reject(new Error('Not logged in.'));

      // eslint-disable-next-line no-param-reassign
      params.accessKey = this._apikey;

      const options = {
        'method': 'GET',
        'hostname': this._host,
        'port': UFV_API_PORT,
        'path': UFV_API_ENDPOINT+ '/' + resource,
        'headers': {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': isBinary ? '*/*' : 'application/json',
          'Authorization': 'Bearer ' + this._authorization,
        },
        'maxRedirects': 20,
        rejectUnauthorized: false,
      };

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to GET url: ${options.path} (status code: ${res.statusCode})`));
        }
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
          if (isBinary) {
            resolve(Buffer.concat(data));
          } else {
            resolve(data.join(''));
          }
        });
      });

      req.on('error', error => reject(error));
      req.end();
    });
  }

  _put(resource, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization) reject(new Error('Not logged in.'));

      const body = JSON.stringify(payload);

      const params = {
        apiKey: this._apikey,
      };

      const options = {
        host: this._host,
        port: UFV_API_PORT,
        path: `${UFV_API_ENDPOINT}/${resource}${this._toQueryString(params)}}`,
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': 'Bearer ' + this._authorization,
        },
        'maxRedirects': 20,
        rejectUnauthorized: false,
      };

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to PUT to url: ${options.host}${options.path} (status code: ${res.statusCode})`));
        }
        res.setEncoding('utf8');
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => resolve(data.join('')));
      });

      req.on('error', error => reject(error));
      req.write(body);
      req.end();
    });
  }

  _patch(resource, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization) reject(new Error('Not logged in.'));

      const body = JSON.stringify(payload);

      const options = {
        host: this._host,
        port: UFV_API_PORT,
        path: `${UFV_API_ENDPOINT}/${resource}`,
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': 'Bearer ' + this._authorization,
        },
        'maxRedirects': 20,
        rejectUnauthorized: false,
      };

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to PATCH to url: ${options.host}${options.path} (status code: ${res.statusCode})`));
        }
        res.setEncoding('utf8');
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => resolve(data.join('')));
      });

      req.on('error', error => reject(error));
      req.write(body);
      req.end();
    });
  }

  _post(resource, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization) reject(new Error('Not logged in.'));

      const body = JSON.stringify(payload);

      const params = {
        apiKey: this._apikey,
      };

      const options = {
        host: this._host,
        port: UFV_API_PORT,
        path: `${UFV_API_ENDPOINT}/${resource}${this._toQueryString(params)}}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': 'Bearer ' + this._authorization,
        },
        'maxRedirects': 20,
        rejectUnauthorized: false,
      };

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to PUT to url: ${options.host}${options.path} (status code: ${res.statusCode})`));
        }
        res.setEncoding('utf8');
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => resolve(data.join('')));
      });

      req.on('error', error => reject(error));
      req.write(body);
      req.end();
    });
  }

  _toQueryString(obj) {
    if (obj === null || typeof obj === 'undefined' || Object.keys(obj).length === 0) {
      return '';
    }
    return `?${Object.keys(obj).map(k => `${k}=${encodeURIComponent(obj[k])}`).join('&')}`;
  }

  discover() {
    const discovery = new UfvDiscovery();

    discovery.on(UfvConstants.DEVICE_ANY, device => {
      console.log(`Discovered device: ${device.hostname} (${device.platform})`);

      switch (device.platform) {
        case UfvConstants.PLATFORM_UVC_G3:
        case UfvConstants.PLATFORM_UVC_G3_PRO:
        case UfvConstants.PLATFORM_UVC_G3_DOME:
        case UfvConstants.PLATFORM_UVC_G3_FLEX:
        case UfvConstants.PLATFORM_UVC_G3_MICRO:
        case UfvConstants.PLATFORM_UVC_G4_PRO:
          this.emit(UfvConstants.DEVICE_CAMERA, device);
          break;

        case UfvConstants.PLATFORM_UVC_NVR:
          this.emit(UfvConstants.DEVICE_NVR, device);
          break;

        default:
          console.warn(`Unsupported device: ${device.platform}`);
          break;
      }
    });

    discovery.scan()
      .then(() => console.log('Done scanning for devices.'))
      .catch(error => console.error(error));
  }

  login(host, username, password) {
    console.log('Logging in.');
    this._host = host;
    return new Promise((resolve, reject) => {
      //if (this._authorization) resolve('Already logged in.');
      if (!this._host) reject(new Error('Invalid host.'));
      if (!username) reject(new Error('Invalid username.'));
      if (!password) reject(new Error('Invalid password.'));

      const credentials = JSON.stringify({
        username: username,
        password: password
      })

      const options = {
        'method': 'POST',
        'hostname': this._host,
        'port': UFV_API_PORT,
        'path': UFV_API_ENDPOINT+ '/auth',
        'headers': {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        },
        'maxRedirects': 20,
        rejectUnauthorized: false,
      };

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed: ${options.path} (status code: ${res.statusCode}) (creds: ${credentials}`));
          return;
        }
        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          const json = JSON.parse(body);

          // Obtain authorization header
          res.rawHeaders.forEach((item, index) => {
            if (item.toLowerCase() === 'authorization' && res.rawHeaders[(index + 1)].toLowerCase() !== 'content-type') {
              this._authorization = res.rawHeaders[index + 1];
            }
          });

          if (this._authorization === null) {
            reject(new Error('Invalid authorization header.'));
          }

          // Everything OK
          resolve('Logged in.');
        });
      });

      req.on('error', error => {
        reject(error);
      });

      req.on('uncaughtException', error => {
        reject(error);
      });

      req.write(credentials);
      req.end();
    });
  }

  getBootstrapInfo() {
    return new Promise((resolve, reject) => {
      this._get('bootstrap')
        .then(response => {
          const result = JSON.parse(response);

          if (result) {
            if (result.accessKey)
            {
              this._apikey = result.accessKey;
              this._rtspPort = result.nvr.ports.rtsp;
            }
            resolve(result);
          } else {
            reject(new Error('Error obtaining bootstrap info.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getAccessKey() {
    return new Promise((resolve, reject) => {
      this._get('auth/access-key')
        .then(response => {
          const result = JSON.parse(response).accessKey;

          if (result) {
            resolve(result);
          } else {
            reject(new Error('Error obtaining access-key.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getServer() {
    return new Promise((resolve, reject) => {
      this._get('bootstrap')
        .then(response => {
          const result = JSON.parse(response).nvr;

          if (result) {
            resolve(result);
          } else {
            reject(new Error('Error obtaining server.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  findCameraById(id) {
    return new Promise((resolve, reject) => {
      this._get(`cameras/${id}`)
        .then(response => {
          const result = JSON.parse(response);

          if (result) {
            resolve(result);
          } else {
            reject(new Error('Error obtaining cameras.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getCameras() {
    return new Promise((resolve, reject) => {
      if (!this._authorization) {
        // Validate NVR IP address
        const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
        if (!nvrip) {
          reject(new Error('NVR IP address not set.'));
        }

        // Validate NVR credentials
        const credentials = Homey.ManagerSettings.get('ufp:credentials');
        if (!credentials) {
          reject(new Error('Credentials not set.'));
        }

        // Log in to NVR
        this.login(nvrip, credentials.username, credentials.password)
          .then(() => {

          })
          .catch(error => console.log(error));
      }

      this._get('bootstrap')
        .then(response => {
          const result = JSON.parse(response).cameras;
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Error obtaining cameras.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  snapshot(id, widthInPixels = 1920) {
    return new Promise((resolve, reject) => {
      if (!id) reject(new Error('Invalid camera identifier.'));

      const height = widthInPixels / 16 * 9;

      this.getBootstrapInfo()
        .then(() => {
          const params = {
            accessKey: this._apikey,
            w: widthInPixels,
            h: height
          };

          let snapshot

          return this._download(`cameras/${id}/snapshot`, params)
            .then(buffer => resolve(buffer))
            .catch(error => reject(new Error(`Error obtaining snapshot buffer: ${error}`)));
        })
        .catch(error => console.log(error));
    });
  }

  createSnapshotUrl(camera) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!camera) reject(new Error('Invalid camera'));
      this.getBootstrapInfo()
        .then(() => {
          const params = {
            accessKey: this._apikey
          };
          resolve(`https://${this._host}:${UFV_API_PORT}${UFV_API_ENDPOINT}/cameras/${camera.id}/snapshot${this._toQueryString(params)}`);
        })
        .catch(error => console.log(error));
    });
  }

  setRecordingMode(camera, mode = "never") {
    return new Promise((resolve, reject) => {

      this.findCameraById(camera.id).then(cameraInfo => {
        let recordingSettings = cameraInfo.recordingSettings;
        recordingSettings.mode = mode;

        const params = {
          recordingSettings: recordingSettings
        }

        return this._patch(`cameras/${camera.id}`, params)
          .then(() => resolve('Recording mode successfully set.'))
          .catch(error => reject(new Error(`Error setting recording mode: ${error}`)));
      }).catch(error => reject(new Error(`Error setting recording mode: ${error}`)));
    });
  }

  getMotionEvents() {
    return new Promise((resolve, reject) => {
      let start = new Date();
      start.setHours(0,0,0,0);
      let end = new Date();
      end.setHours(23,59,59,999);

      let startTime = (this._lastMotionAt == null ? start.getTime() : this._lastMotionAt);

      this._get('events?start=' + startTime + "&end=" + end.getTime() + "&type=motion")
        .then(response => {
          const result = JSON.parse(response);
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Error obtaining cameras.'));
          }
        })
        .catch(error => reject(error));
    });

  }
}

module.exports = UfPapi;
