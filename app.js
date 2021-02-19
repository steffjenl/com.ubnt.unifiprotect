// eslint-disable-next-line node/no-unpublished-require,strict
'use strict';

const Homey = require('homey');
const ProtectAPI = require('./library/protectapi');
const UfvConstants = require('./library/constants');

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
        this.protectapi = new ProtectAPI(this);

        // Register snapshot image token
        await this._registerSnapshotToken();

        // Subscribe to credentials updates
        this.homey.settings.on('set', key => {
            if (key === 'ufp:credentials') {
                this._appLogin();
            }
        });
        this._appLogin();


        Homey.app.debug('UniFiProtect has been initialized');
    }

    async _registerSnapshotToken() {
        // Register snapshot image token
        let snapshotToken = await this.homey.flow.createToken('ufv_snapshot', {
            type: 'image',
            title: 'Snapshot'
        });
    }

    _appLogin() {
        this.debug('Logging in...');

        // Validate NVR IP address
        const nvrip = this.homey.settings.get('ufp:nvrip');
        if (!nvrip) {
            this.debug('NVR IP address not set.');
            return;
        }

        // Setting NVR Port when set
        const nvrport = this.homey.settings.get('ufp:nvrport');

        // Validate NVR credentials
        const credentials = this.homey.settings.get('ufp:credentials');
        if (!credentials) {
            this.debug('Credentials not set.');
            return;
        }

        // Log in to NVR
        this.protectapi.login(nvrip, nvrport, credentials.username, credentials.password)
            .then(() => {
                this.protectapi.getBootstrapInfo()
                    .then(() => {
                        this.debug('Bootstrap loaded.');
                        this.loggedIn = true;
                        this.nvrIp = nvrip;
                        this.nvrPort = nvrport;
                        this.nvrUsername = credentials.username;
                        this.nvrPassword = credentials.password;
                    })
                    .catch(error => this.error(error));
                // _refreshCookie after 45 minutes
                const timeOutFunction = function () {
                    this._refreshCookie();
                }.bind(this);
                setTimeout(timeOutFunction, RefreshCookieTime);
                Homey.app.debug('Logged in.');
            })
            .catch(error => this.error(error));
    }

    _refreshCookie() {
        if (this.loggedIn) {
            this.protectapi._lastUpdateId = null;
            this.protectapi.login(this.nvrIp, this.nvrPort, this.nvrUsername, this.nvrPassword)
                .then(() => {
                    this.debug('Logged in again to refresh cookie.');
                    this.protectapi.getBootstrapInfo()
                        .then(() => {
                            this.debug('Bootstrap loaded.');
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
            this.log(args.join(' '));
        }

        this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_DEBUG, args.join(' '));
    }
}

module.exports = UniFiProtect;
