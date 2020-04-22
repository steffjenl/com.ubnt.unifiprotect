// eslint-disable-next-line node/no-unpublished-require,strict
const Homey = require('homey');

module.exports = [
  {
    method: 'POST',
    path: '/settings/validate',
    fn(args, callback) {
      const Api = Homey.app.api;
      const jsonData = args.body;
      if (jsonData.useProxy === 'true') {
        Api.loginProxy(jsonData.hostname, jsonData.username, jsonData.password).then(result => {
          return callback(null, result);
        }).catch(error => { callback(error)});
      }
      else {
        Api.login(jsonData.hostname, jsonData.username, jsonData.password).then(result => {
          return callback(null, result);
        }).catch(error => { callback(error)});
      }
    },
  },
];
