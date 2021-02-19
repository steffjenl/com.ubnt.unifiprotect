// eslint-disable-next-line node/no-unpublished-require,strict
'use strict';

const Homey = require('homey');
const ProtectAPI = require('./library/protectapi');
const UfvConstants = require('./library/constants');

const ManagerApi = Homey.ManagerApi;

// 2700000 miliseconds is 45 minutes
const RefreshCookieTime = 2700000;

class UniFiProtect extends Homey.App {
    /**
     * onInit is called when the app is initialized.
     */
    async onInit() {
        this.loggedIn = false;
        this.nvrIp = null;
        this.nvrPort = null;
        this.nvrUsername = null;
        this.nvrPassword = null;

        // Enable remote debugging, if applicable
        if (Homey.env.DEBUG === 'true') {
            // eslint-disable-next-line global-require
            require('inspector')
                .open(9229, '0.0.0.0');
        }

        // Single API instance for all devices
        this.api = new ProtectAPI();

        // Register snapshot image token
        this._registerSnapshotToken();

        // Subscribe to credentials updates
        Homey.ManagerSettings.on('set', key => {
            if (key === 'ufp:credentials') {
                this._appLogin();
            }
        });
        this._appLogin();


        Homey.app.debug('UniFiProtect has been initialized');
    }

    _registerSnapshotToken() {
        // Register snapshot image token
        this.snapshotToken = new Homey.FlowToken('ufv_snapshot', {
            type: 'image',
            title: 'Snapshot',
        });
        Homey.ManagerFlow.registerToken(this.snapshotToken);
    }

    _appLogin() {
        Homey.app.debug('Logging in...');

        // Validate NVR IP address
        const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
        if (!nvrip) {
            Homey.app.debug('NVR IP address not set.');
            return;
        }

        // Setting NVR Port when set
        const nvrport = Homey.ManagerSettings.get('ufp:nvrport');

        // Validate NVR credentials
        const credentials = Homey.ManagerSettings.get('ufp:credentials');
        if (!credentials) {
            Homey.app.debug('Credentials not set.');
            return;
        }

        // Log in to NVR
        this.api.login(nvrip, nvrport, credentials.username, credentials.password)
            .then(() => {
                this.api.getBootstrapInfo()
                    .then(() => {
                        Homey.app.debug('Bootstrap loaded.');
                        this.loggedIn = true;
                        this.nvrIp = nvrip;
                        this.nvrPort = nvrport;
                        this.nvrUsername = credentials.username;
                        this.nvrPassword = credentials.password;

                        // _refreshCookie after 45 minutes
                        const timeOutFunction = function () {
                            this._refreshCookie();
                        }.bind(this);
                        setTimeout(timeOutFunction, RefreshCookieTime);

                        Homey.app.debug('Logged in.');
                    })
                    .catch(error => this.error(error));
            })
            .catch(error => this.error(error));
    }

    _refreshCookie() {
        if (this.loggedIn) {
            this.api._lastUpdateId = null;
            this.api.login(this.nvrIp, this.nvrPort, this.nvrUsername, this.nvrPassword)
                .then(() => {
                    Homey.app.debug('Logged in again to refresh cookie.');
                    this.api.getBootstrapInfo()
                        .then(() => {
                            this.log('Bootstrap loaded.');
                            this.loggedIn = true;
                        })
                        .catch(error => this.error(error));
                })
                .catch(error => this.error(error));
        }

        // _refreshCookie after 45 minutes
        const timeOutFunction = function () {
            this._refreshCookie();
        }.bind(this);
        setTimeout(timeOutFunction, RefreshCookieTime);
    }

    debug(message) {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[debug]');

        if (Homey.env.DEBUG === 'true') {
            Homey.app.log(args.join(' '));
        }

        ManagerApi.realtime(UfvConstants.EVENT_SETTINGS_DEBUG, args.join(' '));
    }
}

module.exports = UniFiProtect;
