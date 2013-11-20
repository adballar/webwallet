'use strict';

angular.module('webwalletApp')
  .controller('NavCtrl', function ($scope, $location) {

    $scope.devices = [{
      id: 1,
      title: 'Shopping',
      accounts: [{
        id: 1,
        title: 'Account #1',
        ballance: 123.456
      }]
    }];

    $scope.isActive = function (location) {
      return location === $location.path();
    };
  });
