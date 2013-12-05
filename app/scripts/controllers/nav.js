'use strict';

angular.module('webwalletApp')
  .controller('NavCtrl', function (trezorService, $scope, $location, $routeParams) {

    $scope.devices = trezorService.devices;

    $scope.isActive = function (path) {
      return $location.path().match(path);
    };
  });
