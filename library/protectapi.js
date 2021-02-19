'use strict';

const Homey = require('homey');
const https = require('https');
const ProtectWebClient = require('./webclient');
const ProtectWebSocket = require('./websocket');
const UfvConstants = require('./constants');

let UFV_API_ENDPOINT = '/proxy/protect/api';

class ProtectAPI {

    constructor() {
        // Single WebSocket instance for all devices
        this.ws = new ProtectWebSocket();
        this.webclient = new ProtectWebClient();

        this._bootstrap = null;
        this._lastUpdateId = null;
        this._rtspPort = null;
    }

    getProxyCookieToken() {
        return this.webclient.getCookieToken();
    }

    getHost() {
        return this.webclient.getServerHost();
    }

    getLastUpdateId() {
        return this._lastUpdateId;
    }

    getBootstrap() {
        return this._bootstrap;
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

    login(host, port, username, password) {
        Homey.app.debug('Logging in with proxy.');
        UFV_API_ENDPOINT = '/proxy/protect/api';

        this.webclient.setServerHost(host);
        this.webclient.setServerPort(port);

        return new Promise((resolve, reject) => {
            Homey.ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Connecting');

            if (!host) reject(new Error('Invalid host.'));
            if (!username) reject(new Error('Invalid username.'));
            if (!password) reject(new Error('Invalid password.'));

            const credentials = JSON.stringify({
                username,
                password,
            });

            const options = {
                method: 'POST',
                hostname: host,
                port: port,
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
                            this.webclient.setCookieToken(res.rawHeaders[index + 1]);
                        }
                    });

                    if (this.webclient.getCookieToken() === null) {
                        reject(new Error('Invalid set-cookie header.'));
                        return;
                    }

                    // Connected
                    Homey.ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Connected');
                    //
                    return resolve('Logged in with proxy.');
                });
            });

            req.on('error', error => {
                Homey.ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Disconnected');
                return reject(error);
            });

            req.write(credentials);
            req.end();
        });
    }

    getBootstrapInfo() {
        return new Promise((resolve, reject) => {
            this.webclient.get('bootstrap')
                .then(response => {
                    const result = JSON.parse(response);

                    if (result) {
                        this._bootstrap = result;

                        if (result.accessKey) {
                            this.webclient.setApiKey(result.accessKey);
                            this._rtspPort = result.nvr.ports.rtsp;
                            this._lastUpdateId = result.lastUpdateId;
                        }

                        // lastUpdateId is changed, please reconnect to websocket
                        this.ws.reconnectUpdatesListener();

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
            this.webclient.post('auth/access-key')
                .then(response => {
                    const result = JSON.parse(response);
                    this.webclient.setApiKey(result.accessKey);

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
            this.webclient.get('debug/info')
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
            this.webclient.get('nvr')
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
            this.webclient.get(`cameras/${id}`)
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
            this.webclient.get('cameras')
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

            const height = this.getAspectRatioHeight(id, widthInPixels);

            const params = {
                accessKey: this.webclient.getApiKey(),
                w: widthInPixels,
                h: height,
                force: true,
            };

            let snapshot;
            return this.webclient.download(`cameras/${id}/snapshot`, params)
                .then(buffer => resolve(buffer))
                .catch(error => reject(new Error(`Error obtaining snapshot buffer: ${error}`)));
        });
    }

    createSnapshotUrl(camera, widthInPixels = 1920) {
        return new Promise((resolve, reject) => {
            if (!this.webclient.getServerHost()) reject(new Error('Invalid host.'));
            if (!camera) reject(new Error('Invalid camera'));
            const height = this.getAspectRatioHeight(camera.id, widthInPixels);

            const params = {
                accessKey: this.webclient.getApiKey(),
                w: widthInPixels,
                h: height,
                force: true,
                ts: Date.now()
            };
            return resolve(`https://${this.webclient.getServerHost()}:${this.webclient.getServerPort()}${UFV_API_ENDPOINT}/cameras/${camera.id}/snapshot${this.webclient.toQueryString(params)}`);
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
                    return this.webclient.patch(`cameras/${camera.id}`, params)
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
            return this.webclient.patch(`cameras/${camera.id}`, params)
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

            this.webclient.get(`events?start=${startTime}&end=${end.getTime()}&type=motion`)
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

    getAspectRatioHeight(cameraId, widthInPixels) {
        this._bootstrap.cameras.forEach(camera => {
            if (camera.id === cameraId) {
                if (camera.type === 'UVC G4 Doorbell') {
                    return widthInPixels / 4 * 3;
                } else {
                    return widthInPixels / 16 * 9;
                }
            }
        });
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

                    resolve(`rtsp://${this.webclient.getServerHost()}:${this._rtspPort}/${rtspAlias}`);
                })
                .catch(error => reject(new Error(`Error getting steam url: ${error}`)));
        });
    }
}

module.exports = ProtectAPI;
