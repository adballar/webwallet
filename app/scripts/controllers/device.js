'use strict';

angular.module('webwalletApp')
  .controller('DeviceCtrl', function (trezorService, $scope, $location, $routeParams) {
    $scope.device = trezorService.get($routeParams.deviceId);
    if (!$scope.device)
      return $location.path('/');

    $scope.settings = {};

    $scope.forget = function (dev) {
      trezorService.forget(dev.id);
      $location.path('/');
    };

    $scope.setup = function (dev, settings) {
      if (settings.label)
        settings.label = settings.label.trim();

      dev.reset(settings)
        .then(
          function (result) { $location.path('/'); },
          function (err) { alert(err); }
        );
    };

    $scope.loadByXprv = function (dev, settings) {
      if (settings.label)
        settings.label = settings.label.trim();
      if (settings.xprv)
        settings.xprv = settings.xprv.trim();

      dev.loadByXprv(settings)
        .then(
          function (result) { $location.path('/'); },
          function (err) { alert(err); }
        );
    };
  });
