'use strict';

angular.module('webwalletApp')
  .controller('DeviceCtrl', function (trezorService, $scope, $location, $routeParams) {
    $scope.device = trezorService.get($routeParams.deviceId);
    if (!$scope.device) {
      $location.path('/');
      return;
    }

    $scope.forget = function (dev) {
      trezorService.forget(dev.serialNumber);
      $location.path('/');
    };
  });
