'use strict';

angular.module('webwalletApp')
  .service('backendService', function BackendService(utils, $http) {

    var self = this,
        API_URL = 'http://test-api.bitsofproof.com:8080/trezor';

    self.register = function (node) {
      var url = API_URL + '/register',
          xpub = utils.node2xpub(node),
          data = {
            after: '2013-12-01',
            publicMaster: xpub,
            lookAhead: 10,
            firstIndex: 0
          };

      console.log('[backend] Registering public key', xpub);
      return self.deregister(node).then(function () {
        return $http.post(url, data);
      });
    };

    self.deregister = function (node) {
      var xpub = utils.node2xpub(node),
          url = API_URL + '/' + xpub;

      return $http.delete(url);
    };

    self.balance = function (node, details) {
      var xpub = utils.node2xpub(node),
          url = API_URL + '/' + xpub + (details ? '?details' : '');

      console.log('[backend] Requesting balance for', xpub);
      return $http.get(url);
    };

    self.transactions = function (node) {
      var xpub = utils.node2xpub(node),
          url = API_URL + '/' + xpub + '/transactions';

      return $http.get(url);
    };

  });
