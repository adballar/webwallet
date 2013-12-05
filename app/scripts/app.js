'use strict';

angular.module('webwalletApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngRoute'
])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });

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