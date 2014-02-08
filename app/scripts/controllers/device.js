'use strict';

// jshint curly:false, camelcase:false, latedef:nofunc

angular.module('webwalletApp')
  .controller('DeviceCtrl', function (trezorService, bip39, flash, $scope, $location, $routeParams) {
    $scope.device = trezorService.get($routeParams.deviceId);
    if (!$scope.device)
      return $location.path('/');

    $scope.forget = function (dev) {
      trezorService.forget(dev.id);
      $location.path('/');
    };

    $scope.wipe = function (dev) {
      dev.wipe()
        .then(
          function (res) { $location.path('/'); },
          function (err) { flash.error(err.message || 'Wiping failed'); }
        );
    };

    $scope.settings = {
      pin_protection: true,
      language: 'english'
    };

    $scope.setup = function (dev, settings) {
      if (settings.label)
        settings.label = settings.label.trim();
      dev.reset(settings)
        .then(
          function (res) { $location.path('/'); },
          function (err) { flash.error(err.message || 'Setup failed'); }
        );
    };

    $scope.load = function (dev, settings) {
      if (settings.label)
        settings.label = settings.label.trim();
      settings.payload = settings.payload.trim();
      dev.load(settings)
        .then(
          function (res) { $location.path('/'); },
          function (err) { flash.error(err.message || 'Importing failed'); }
        );
    };

    $scope.seedWord = '';
    $scope.seedWords = [];
    $scope.seedWordlist = bip39.english;

    $scope.recover = function (dev, settings) {
      if (settings.label)
        settings.label = settings.label.trim();
      $scope.recovering = true;
      dev.recover(settings)
        .then(
          function (res) { $location.path('/'); },
          function (err) { flash.error(err.message || 'Recovery failed'); }
        );
    };

    $scope.recoverWord = function () {
      $scope.seedWords.push($scope.seedWord);
      $scope.wordCallback($scope.seedWord);
      $scope.seedWord = '';
    };

  });
