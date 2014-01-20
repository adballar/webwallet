'use strict';

angular.module('webwalletApp')
  .controller('AccountCtrl', function (trezorService, utils, $document, $scope, $location, $routeParams) {
    $scope.device = trezorService.get($routeParams.deviceId);
    if (!$scope.device)
      return $location.path('/');

    $scope.account = $scope.device.account($routeParams.accountId);
    if (!$scope.account)
      return $location.path('/');

    $scope.activeAddressIndex = 0;
    $scope.addressCount = 1;
    $scope.lookAhead = 10;
    $scope.addresses = $scope.account.addresses($scope.addressCount);

    $scope.activate = function (index) {
      $scope.activeAddressIndex = index;
    };

    $scope.more = function () {
      $scope.addressCount++;
      $scope.activeAddressIndex++;
      $scope.addresses = $scope.account.addresses($scope.addressCount);
    };
  });