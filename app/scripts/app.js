'use strict';

angular.module('webwalletApp', [
  'ngRoute',
  'ngAnimate',
  'mgcrea.ngStrap',
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
      .when('/device/:deviceId/load', {
        templateUrl: 'views/load.html',
        controller: 'DeviceCtrl'
      })
      .when('/device/:deviceId/recovery', {
        templateUrl: 'views/recovery.html',
        controller: 'DeviceCtrl'
      })
      .when('/device/:deviceId/wipe', {
        templateUrl: 'views/wipe.html',
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
  trezor.load({ configUrl: '/data/config_signed.bin' }).then(
    function (trezorObject) {
      angular.module('webwalletApp').value('trezorApi', trezor);
      angular.module('webwalletApp').value('trezor', trezorObject);
      angular.bootstrap(document, ['webwalletApp']);
    },
    function (err) {
      console.error(err);
      if (err.install)
        err.install();
    }
  );
});
