'use strict';

const https = require('https');

let UFV_API_ENDPOINT = '/proxy/protect/api';

class ProtectWebClient {

    constructor() {
        this._serverHost = null;
        this._serverPort = null;
        this._cookieToken = null;
        this._apiKey = null;
        this._csrfToken = null;
    }

    setServerHost(hostName) {
        this._serverHost = hostName;
    }

    setServerPort(serverPort) {
        this._serverPort = serverPort;
    }

    setCookieToken(cookieToken) {
        this._cookieToken = cookieToken;
    }

    setApiKey(apiKey) {
        this._apiKey = apiKey;
    }

    getServerHost() {
        return this._serverHost;
    }

    getServerPort() {
        return this._serverPort;
    }

    getCookieToken() {
        return this._cookieToken;
    }

    getApiKey() {
        return this._apiKey;
    }

    getCSRFToken() {
        return this._csrfToken;
    }

    setCSRFToken(csrfToken) {
        this._csrfToken = csrfToken;
    }

    get(resource, params = {}, isBinary = false) {
        return new Promise((resolve, reject) => {
            if (!this._serverHost) reject(new Error('Invalid host.'));
            if (!this._cookieToken) reject(new Error('Not logged in.'));

            // eslint-disable-next-line no-param-reassign
            params.accessKey = this._apiKey;

            const options = {
                method: 'GET',
                hostname: this._serverHost,
                port: this._serverPort,
                path: `${UFV_API_ENDPOINT}/${resource}${this.toQueryString(params)}`,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Accept: isBinary ? '*/*' : 'application/json',
                    'Cookie': this._cookieToken,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

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
                            this._cookieToken = res.rawHeaders[index + 1];
                        }

                        if (item.toLowerCase() === 'x-csrf-token') {
                            //this._csrfToken = res.rawHeaders[index + 1];
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

    put(resource, payload = {}) {
        return new Promise((resolve, reject) => {
            if (!this._serverHost) reject(new Error('Invalid host.'));
            if (!this._cookieToken) reject(new Error('Not logged in.'));

            const body = JSON.stringify(payload);

            const params = {
                apiKey: this._apiKey,
            };

            const options = {
                host: this._serverHost,
                port: this._serverPort,
                path: `${UFV_API_ENDPOINT}/${resource}${this.toQueryString(params)}`,
                method: 'PUT',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                    'Cookie': this._cookieToken,
                    'x-csrf-token': this._csrfToken,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

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
                            this._cookieToken = res.rawHeaders[index + 1];
                        }

                        if (item.toLowerCase() === 'x-csrf-token') {
                            //this._csrfToken = res.rawHeaders[index + 1];
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

    patch(resource, payload = {}) {
        return new Promise((resolve, reject) => {
            if (!this._serverHost) reject(new Error('Invalid host.'));
            if (!this._cookieToken) reject(new Error('Not logged in.'));

            const body = JSON.stringify(payload);

            const options = {
                host: this._serverHost,
                port: this._serverPort,
                path: `${UFV_API_ENDPOINT}/${resource}`,
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                    'Cookie': this._cookieToken,
                    'x-csrf-token': this._csrfToken,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to PATCH url: ${options.path} (status code: ${res.statusCode})`));
                }
                res.setEncoding('utf8');
                const data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    // Obtain authorization header
                    res.rawHeaders.forEach((item, index) => {
                        if (item.toLowerCase() === 'set-cookie') {
                            this._cookieToken = res.rawHeaders[index + 1];
                        }

                        if (item.toLowerCase() === 'x-csrf-token') {
                            //this._csrfToken = res.rawHeaders[index + 1];
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

    post(resource, payload = {}) {
        return new Promise((resolve, reject) => {
            if (!this._serverHost) reject(new Error('Invalid host.'));
            if (!this._cookieToken) reject(new Error('Not logged in.'));

            const body = JSON.stringify(payload);

            const options = {
                host: this._serverHost,
                port: this._serverPort,
                path: `${UFV_API_ENDPOINT}/${resource}`,
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                    'Cookie': this._cookieToken,
                    'x-csrf-token': this._csrfToken,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

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
                            this._cookieToken = res.rawHeaders[index + 1];
                        }

                        if (item.toLowerCase() === 'x-csrf-token') {
                            //this._csrfToken = res.rawHeaders[index + 1];
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

    download(resource, params) {
        return this.get(resource, params, true);
    }

    toQueryString(obj) {
        if (obj === null || typeof obj === 'undefined' || Object.keys(obj).length === 0) {
            return '';
        }
        return `?${Object.keys(obj)
            .map(k => `${k}=${encodeURIComponent(obj[k])}`)
            .join('&')}`;
    }
}

module.exports = ProtectWebClient;
