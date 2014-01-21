'use strict';

angular.module('webwalletApp')
  .value('atmosphere', window.jQuery.atmosphere);


angular.module('webwalletApp')
  .config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
  }]);

angular.module('webwalletApp')
  .service('backendService', function BackendService(utils, atmosphere, $http, $log) {

    var self = this,
        endpoint = 'http://test-api.bitsofproof.com:8080';

    function api(url) {
      return endpoint + '/trezor/' + url;
    }

    function ws(url) {
      return endpoint + '/ws/' + url;
    }

    self.register = function (node) {
      var xpub = utils.node2xpub(node),
          data = {
            after: '2013-12-01',
            publicMaster: xpub,
            lookAhead: 10,
            firstIndex: 0
          };

      $log.debug('Registering public key', xpub);
      return self.deregister(node).then(function () {
        return $http.post(api('register'), data);
      });
    };

    self.deregister = function (node) {
      var xpub = utils.node2xpub(node);

      $log.debug('Deregistering public key', xpub);
      return $http.delete(api(xpub));
    };

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

    self.subscribe = function (node, callback) {
      var xpub = utils.node2xpub(node),
          req = new atmosphere.AtmosphereRequest();

      req.url = ws(xpub);
      req.contentType = 'application/json';
      req.transport = 'websocket';
      req.fallbackTransport = 'long-polling';
      req.trackMessageLength = true;
      req.enableXDR = true;

      req.onClientTimeout = function (req) {
          $log.error('WS client timed out');
      };
      req.onTransportFailure = function (err, req) {
          $log.error('WS request failure:', err);
      };
      req.onError = function (res) {
          $log.error('WS error:', res);
      };
      req.onReconnect = function (req, res) {
          $log.info('WS client reconnected');
      };

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
