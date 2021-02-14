/* eslint-disable no-console */

'use strict';

const Homey = require('homey');
const https = require('https');

const UfvDiscovery = require('./ufvdiscovery');
const UfvConstants = require('./ufvconstants');
const UfPWebsocket = require('./websocket');

let UFV_API_ENDPOINT = '/api';
let UFV_API_PORT = 443;

const ManagerApi = Homey.ManagerApi;

class UfPapi {
  constructor() {
    this._apikey = null;
    this._authorization = null;
    this._lastMotionAt = null;
    this._lastRingAt = null;
    this._rtspPort = null;
    this._proxyCookieToken = null;
    this._proxyCookieTokenExpire = null;
    this._nvrPort = UFV_API_PORT;
    this._eventListener = null;
    this._eventListenerConfigured = null;
    this._bootstrap = null;
    this.ws = new UfPWebsocket();

  }

  setLastMotionAt(lastMotionAt) {
    this._lastMotionAt = lastMotionAt;
    return this;
  }

  setLastRingAt(lastRingAt) {
    this._lastRingAt = lastRingAt;
    return this;
  }

  getApiKey() {
    return this._apikey;
  }

  getHost() {
    return this._host;
  }

  getProxyCookieToken() {
    return this._proxyCookieToken;
  }

  getAuthorization() {
    return this._authorization;
  }

  setApiPort(port) {
    this._nvrPort = port;
  }

  getLastUpdateId() {
    return this._lastUpdateId;
  }

  getNvrName() {
    if (typeof this._bootstrap.nvr.name !== 'undefined' && this._bootstrap.nvr.name !== null) {
      return this._bootstrap.nvr.name;
    }
    if (typeof this._bootstrap.nvr.host !== 'undefined' && this._bootstrap.nvr.host !== null) {
      return this._bootstrap.nvr.host;
    }
    if (typeof this._bootstrap.nvr.id !== 'undefined' && this._bootstrap.nvr.id !== null) {
      return this._bootstrap.nvr.id;
    }

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
            resolve('');
          }

          resolve(`rtsp://${this.getHost()}:${this._rtspPort}/${rtspAlias}`);
        })
        .catch(error => reject(new Error(`Error getting steam url: ${error}`)));
    });
  }

  _get(resource, params = {}, isBinary = false) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization && !this._proxyCookieToken) reject(new Error('Not logged in.'));

      // eslint-disable-next-line no-param-reassign
      params.accessKey = this._apikey;

      const options = {
        method: 'GET',
        hostname: this._host,
        port: this._nvrPort,
        path: `${UFV_API_ENDPOINT}/${resource}`,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: isBinary ? '*/*' : 'application/json',
        },
        maxRedirects: 20,
        rejectUnauthorized: false,
        keepAlive: false,
      };

      options.headers['Cookie'] = this._proxyCookieToken;

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to GET url: ${options.path} (status code: ${res.statusCode})`));
        }
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
          // Obtain authorization header
          res.rawHeaders.forEach((item, index) => {
            if (item.toLowerCase() === 'set-cookie') {
              this._proxyCookieToken = res.rawHeaders[index + 1];
            }
          });

          if (isBinary) {
            return resolve(Buffer.concat(data));
          } else {
            return resolve(data.join(''));
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
      if (!this._authorization && !this._proxyCookieToken) reject(new Error('Not logged in.'));

      const body = JSON.stringify(payload);

      const params = {
        apiKey: this._apikey,
      };

      const options = {
        host: this._host,
        port: this._nvrPort,
        path: `${UFV_API_ENDPOINT}/${resource}${this._toQueryString(params)}`,
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        maxRedirects: 20,
        rejectUnauthorized: false,
        keepAlive: false,
      };

      options.headers['Cookie'] = this._proxyCookieToken;

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to PUT to url: ${options.host}${options.path} (status code: ${res.statusCode})`));
        }
        res.setEncoding('utf8');
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
          // Obtain authorization header
          res.rawHeaders.forEach((item, index) => {
            if (item.toLowerCase() === 'set-cookie') {
              this._proxyCookieToken = res.rawHeaders[index + 1];
            }
          });

          return resolve(data.join(''));
        });
      });

      req.on('error', error => reject(error));
      req.write(body);
      req.end();
    });
  }

  _patch(resource, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization && !this._proxyCookieToken) reject(new Error('Not logged in.'));

      const body = JSON.stringify(payload);

      const options = {
        host: this._host,
        port: this._nvrPort,
        path: `${UFV_API_ENDPOINT}/${resource}`,
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        maxRedirects: 20,
        rejectUnauthorized: false,
        keepAlive: false,
      };

      options.headers['Cookie'] = this._proxyCookieToken;

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to PATCH to url: ${options.host}${options.path} (status code: ${res.statusCode})`));
        }
        res.setEncoding('utf8');
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
          // Obtain authorization header
          res.rawHeaders.forEach((item, index) => {
            if (item.toLowerCase() === 'set-cookie') {
              this._proxyCookieToken = res.rawHeaders[index + 1];
            }
          });

          return resolve(data.join(''));
        });
      });

      req.on('error', error => reject(error));
      req.write(body);
      req.end();
    });
  }

  _post(resource, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!this._authorization && !this._proxyCookieToken) reject(new Error('Not logged in.'));

      const body = JSON.stringify(payload);

      const options = {
        host: this._host,
        port: this._nvrPort,
        path: `${UFV_API_ENDPOINT}/${resource}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        maxRedirects: 20,
        rejectUnauthorized: false,
        keepAlive: false,
      };

      options.headers['Cookie'] = this._proxyCookieToken;

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to POST to url: ${options.host}${options.path} (status code: ${res.statusCode})`));
        }
        res.setEncoding('utf8');
        const data = [];

        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
          // Obtain authorization header
          res.rawHeaders.forEach((item, index) => {
            if (item.toLowerCase() === 'set-cookie') {
              this._proxyCookieToken = res.rawHeaders[index + 1];
            }
          });

          return resolve(data.join(''));
        });
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
    return `?${Object.keys(obj)
      .map(k => `${k}=${encodeURIComponent(obj[k])}`)
      .join('&')}`;
  }

  discover() {
    const discovery = new UfvDiscovery();

    discovery.on(UfvConstants.DEVICE_ANY, device => {
      console.log(`Discovered device: ${device.hostname} (${device.platform}) (${device.ip})`);

      switch (device.platform) {
        case UfvConstants.PLATFORM_UVC_G3:
        case UfvConstants.PLATFORM_UVC_G3_PRO:
        case UfvConstants.PLATFORM_UVC_G3_DOME:
        case UfvConstants.PLATFORM_UVC_G3_FLEX:
        case UfvConstants.PLATFORM_UVC_G3_MICRO:
        case UfvConstants.PLATFORM_UVC_G4_PRO:
        case UfvConstants.PLATFORM_UVC_G4_BULLET:
          this.emit(UfvConstants.DEVICE_CAMERA, device);
          break;

        case UfvConstants.PLATFORM_UVC_NVR:
          this.emit(UfvConstants.DEVICE_NVR, device);
          break;

        default:
          console.warn(`[discover] Unsupported device: ${device.platform}`);
          break;
      }
    });

    discovery.scan()
      .then(() => console.log('Done scanning for devices.'))
      .catch(error => console.error(error));
  }

  loginProxy(host, username, password) {
    Homey.app.debug('Logging in with proxy.');
    UFV_API_ENDPOINT = '/proxy/protect/api';
    this._host = host;

    return new Promise((resolve, reject) => {
      ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Connecting');

      // if (this._authorization) resolve('Already logged in.');
      if (!this._host) reject(new Error('Invalid host.'));
      if (!username) reject(new Error('Invalid username.'));
      if (!password) reject(new Error('Invalid password.'));

      const credentials = JSON.stringify({
        username,
        password,
      });

      const options = {
        method: 'POST',
        hostname: this._host,
        port: this._nvrPort,
        path: '/api/auth/login',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json',
        },
        maxRedirects: 20,
        rejectUnauthorized: false,
        timeout: 2000,
        keepAlive: false,
      };

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Request failed: ${options.path} (status code: ${res.statusCode}) (creds: ${credentials}`));
        }
        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          const json = JSON.parse(body);

          // Obtain authorization header
          res.rawHeaders.forEach((item, index) => {
            if (item.toLowerCase() === 'set-cookie') {
              this._proxyCookieToken = res.rawHeaders[index + 1];
            }
          });

          if (this._proxyCookieToken === null) {
            reject(new Error('Invalid set-cookie header.'));
            return;
          }
          // Connected
          ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Connected');
          //
          return resolve('Logged in with proxy.');
        });
      });

      req.on('error', error => {
        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Disconnected');
        return reject(error);
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
            this._bootstrap = result;
            if (result.accessKey) {
              this._apikey = result.accessKey;
              this._rtspPort = result.nvr.ports.rtsp;
              this._lastUpdateId = result.lastUpdateId;
            }
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining bootstrap info.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getAccessKey() {
    return new Promise((resolve, reject) => {
      this._post('auth/access-key')
        .then(response => {
          const result = JSON.parse(response).accessKey;
          this._apikey = result.accessKey;

          if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining access-key.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getDebugInfo() {
    return new Promise((resolve, reject) => {
      this._get('debug/info')
        .then(response => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining server.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getServer() {
    return new Promise((resolve, reject) => {
      this._get('nvr')
        .then(response => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining server.'));
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
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining cameras.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  getCameras() {
    return new Promise((resolve, reject) => {
      this._get('cameras')
        .then(response => {
          const result = JSON.parse(response);
          if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining cameras.'));
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
            h: height,
          };

          let snapshot;
          return this._download(`cameras/${id}/snapshot`, params)
            .then(buffer => resolve(buffer))
            .catch(error => reject(new Error(`Error obtaining snapshot buffer: ${error}`)));
        })
        .catch(error => console.log(error));
    });
  }

  createSnapshotUrl(camera, widthInPixels = 1920) {
    return new Promise((resolve, reject) => {
      if (!this._host) reject(new Error('Invalid host.'));
      if (!camera) reject(new Error('Invalid camera'));
      this.getBootstrapInfo()
        .then(() => {
          const height = widthInPixels / 16 * 9;

          const params = {
            accessKey: this.getApiKey(),
            w: widthInPixels,
            h: height,
            ts: Date.now()
          };
          return resolve(`https://${this._host}:${this._nvrPort}${UFV_API_ENDPOINT}/cameras/${camera.id}/snapshot${this._toQueryString(params)}`);
        })
        .catch(error => console.log(error));
    });
  }

  setRecordingMode(camera, mode = 'never') {
    return new Promise((resolve, reject) => {
      this.findCameraById(camera.id)
        .then(cameraInfo => {
          const recordingSettings = cameraInfo.recordingSettings;
          recordingSettings.mode = mode;

          const params = {
            recordingSettings,
          };
          return this._patch(`cameras/${camera.id}`, params)
            .then(() => resolve('Recording mode successfully set.'))
            .catch(error => reject(new Error(`Error setting recording mode: ${error}`)));
        })
        .catch(error => reject(new Error(`Error setting recording mode: ${error}`)));
    });
  }

  setMicVolume(camera, volume = 100) {
    return new Promise((resolve, reject) => {
      const params = {
        micVolume: volume,
      };
      return this._patch(`cameras/${camera.id}`, params)
        .then(() => resolve('Mic volume successfully set.'))
        .catch(error => reject(new Error(`Error setting mic volume: ${error}`)));
    });
  }

  getMotionEvents() {
    return new Promise((resolve, reject) => {
      let start = new Date();
      start.setHours(0, 0, 0, 0);
      let end = new Date();
      end.setHours(23, 59, 59, 999);

      let startTime = (this._lastMotionAt == null ? start.getTime() : this._lastMotionAt);

      this._get(`events?start=${startTime}&end=${end.getTime()}&type=motion`)
        .then(response => {
          start = null;
          end = null;
          startTime = null;
          const result = JSON.parse(response);
          if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining motion events.'));
          }
        })
        .catch(error => reject(error));
    });
  }
}

module.exports = UfPapi;
