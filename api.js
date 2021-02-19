'use strict';

const Homey = require('homey');

module.exports = [
    {
        method: 'POST',
        path: '/settings/validate',
        fn(args, callback) {
            Homey.app.protectapi.login(args.body.hostname, args.body.port, args.body.username, args.body.password)
                .then(result => {
                    return callback(null, result);
                })
                .catch(error => {
                    callback(error);
                });
        },
    },
];
