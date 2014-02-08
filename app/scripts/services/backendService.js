'use strict';

// jshint curly:false, camelcase:false, latedef:nofunc

angular.module('webwalletApp')
  .value('atmosphere', window.jQuery.atmosphere);

angular.module('webwalletApp')
  .value('backendEndpoint', 'http://test-api.bitsofproof.com:8080');

angular.module('webwalletApp')
  .config(function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
  });

angular.module('webwalletApp')
  .service('backendService', function BackendService(backendEndpoint, utils, atmosphere, Crypto, $http, $log) {

    var self = this;

    function api(url) {
      return backendEndpoint + '/trezor/' + url;
    }

    function ws(url) {
      return backendEndpoint + '/ws/' + url;
    }

    // POST

    self.register = function (node) {
      var xpub = utils.node2xpub(node),
          data = {
            after: '2013-12-01',
            publicMaster: xpub,
            lookAhead: 10,
            firstIndex: 0
          };

      $log.debug('Registering public key', xpub);
      return $http.post(api('register'), data);
    };

    self.deregister = function (node) {
      var xpub = utils.node2xpub(node);

      $log.debug('Deregistering public key', xpub);
      return $http.delete(api(xpub));
    };

    self.send = function (rawTx) {
      var txbytes = utils.hex2bytes(rawTx),
          txhash = Crypto.SHA256(Crypto.SHA256(txbytes, {asBytes: true}), {asBytes: true}),
          data = {
            transaction: Crypto.util.bytesToBase64(txbytes),
            transactionHash: Crypto.util.bytesToBase64(txhash)
          };
      $log.debug('Sending', rawTx);
      return $http.post(api('send'), data);
    };

    // GET

    self.balance = function (node) {
      var xpub = utils.node2xpub(node);

      $log.debug('Requesting balance for', xpub);
      return $http.get(api(xpub + '?details'));
    };

    self.transactions = function (node) {
      var xpub = utils.node2xpub(node);

      $log.debug('Requesting tx history for', xpub);
      return $http.get(api(xpub + '/transactions'));
    };

    self.lookupTx = function (node, hash) {
      var xpub = utils.node2xpub(node);

      $log.debug('Looking up tx', hash, 'for', xpub);
      return $http.get(api(xpub + '/transactions/' + hash));
    };

    self.subscribe = function (node, callback) {
      var xpub = utils.node2xpub(node),
          req = new atmosphere.AtmosphereRequest();

      req.url = ws(xpub);
      req.contentType = 'application/json';
      req.transport = 'websocket';
      req.fallbackTransport = 'long-polling';
      req.trackMessageLength = true;
      req.enableXDR = true;

      req.onMessage = function (res) {
        var msg = res.responseBody,
            ret;
        try {
          ret = JSON.parse(msg);
        } catch (e) {
          $log.error('Error parsing JSON response:', msg);
        }
        if (ret) callback(ret);
      };

      $log.debug('Subscribing to balance updates for', xpub);
      atmosphere.subscribe(req);
    };

  });
