'use strict';

angular.module('webwalletApp')
  .controller('MainCtrl', function (trezorService, $scope) {

    $scope.devices = trezorService.devices;

  });
