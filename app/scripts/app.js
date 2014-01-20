'use strict';

angular.module('webwalletApp', [
  'ngRoute',
  'ngAnimate',
  'ja.qr'
])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .when('/device/:deviceId', {
        templateUrl: 'views/device.html',
        controller: 'DeviceCtrl'
      })
      .when('/device/:deviceId/setup', {
        templateUrl: 'views/setup.html',
        controller: 'DeviceCtrl'
      })
      .when('/device/:deviceId/account/:accountId', {
        templateUrl: 'views/account.html',
        controller: 'AccountCtrl'
      })
      .when('/device/:deviceId/account/:accountId/send', {
        templateUrl: 'views/send.html',
        controller: 'AccountCtrl'
      })
      .when('/device/:deviceId/account/:accountId/receive', {
        templateUrl: 'views/receive.html',
        controller: 'AccountCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });

// load trezor plugin and bootstrap application
angular.element(document).ready(function () {
  trezor.load(
    function (tzr) {
      angular.module('webwalletApp').value('trezor', tzr);
      angular.bootstrap(document, ['webwalletApp']);
    },
    function (err, install) {
      if (install) install();
    },
    { configUrl: 'http://127.0.0.1:9000/config_signed.bin' }
  );
});
