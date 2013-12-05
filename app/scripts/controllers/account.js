'use strict';

angular.module('webwalletApp')
  .controller('AccountCtrl', function (trezorService, $scope, $location, $routeParams) {
    $scope.device = trezorService.get($routeParams.deviceId);
    if (!$scope.device) {
      $location.path('/');
      return;
    }

    $scope.account = $scope.device.account($routeParams.accountId);
    if (!$scope.account)
      $location.path('/');
  });

angular.module('webwalletApp')
  .filter('sign', function () {
    return function (value) {
      return value < 0 ? '-' : '+';
    };
  });

angular.module('webwalletApp')
  .filter('amount', function () {
    return function (value, account) { return value; }
  });
