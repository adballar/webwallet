'use strict';

// jshint curly:false, camelcase:false, latedef:nofunc

angular.module('webwalletApp')
  .service('trezorService', function TrezorService(utils, storage, trezor, TrezorDevice,
      $modal, $q, $rootScope) {

    var self = this,
        STORAGE_DEVICES = 'trezorServiceDevices';

    self.get = getDevice;
    self.forget = forgetDevice;
    self.devices = deserialize(restore()); // the list of available devices

    storeWhenChanged();
    keepUpdating(1000);
    keepRefreshing();

    // public functions

    // finds a device by sn
    function getDevice(sn) {
      return utils.find(self.devices, sn, compareDeviceWithId);
    }

    // finds a device by sn and removes it from the list and the storage
    function forgetDevice(sn) {
      var idx = utils.findIndex(self.devices, sn, compareDeviceWithId),
          dev;

      if (idx >= 0)
        dev = self.devices[idx];
      if (!dev) return;

      dev.disconnect();
      dev.unsubscribe(true); // deregister
      self.devices.splice(idx, 1);
    }

    // serialize a device list
    function serialize(devices) {
      return devices.map(function (dev) {
        return dev.serialize();
      });
    }

    // private functions

    // deserialize a device list
    function deserialize(data) {
      return data.map(function (item) {
        return TrezorDevice.deserialize(item);
      });
    }

    // takes serialized device list, puts it to storage
    function store(data) {
      storage[STORAGE_DEVICES] = JSON.stringify(data);
    }

    // loads a serialized device list from storage
    function restore() {
      return storage[STORAGE_DEVICES]
        ? JSON.parse(storage[STORAGE_DEVICES])
        : [];
    }

    // watches the device list and persist it to storage on change
    function storeWhenChanged() {
      $rootScope.$watch(
        function () {
          return serialize(self.devices);
        },
        function (data) {
          store(data);
        },
        true // deep compare
      );
    }

    // starts auto-updating the device list
    function keepUpdating(n) {
      var tick = utils.tick(n),
          desc = progressWithConnected(tick),
          delta = progressWithDescriptorDelta(desc);

      // handle added/removed devices
      delta.then(null, null, function (dd) {
        dd.added.forEach(connect);
        dd.removed.forEach(disconnect);
      });
    }

    // start auto-refreshing the data in the device list
    function keepRefreshing() {
      self.devices.forEach(function (dev) {
        dev.subscribe();
      });
    }

    // marks the device of the given descriptor as connected, adding it to the
    // device list if not present and loading it
    function connect(desc) {
      var dev = utils.find(self.devices, desc, compareById);

      if (!dev) {
        dev = dev = new TrezorDevice(desc.id);
        self.devices.push(dev);
      }

      if (!dev.is('connected')) {
        dev.connect(desc);
        dev.initializeAndLoadAccounts();
      }

      setupCallbacks(dev);
    }

    function setupCallbacks(dev) {
      // FIXME: this doesnt belong here

      dev.callbacks.pin = function (message, callback) {
        var scope = $rootScope.$new(),
            modal;
        scope.pin = '';
        scope.message = message;
        scope.callback = callback;
        modal = $modal({
          template: 'views/modal.pin.html',
          backdrop: 'static',
          keyboard: false,
          scope: scope
        });
        modal.$promise.then(null, function () {
          callback();
        });
      };

      dev.callbacks.passphrase = function (callback) {
        var scope = $rootScope.$new(),
            modal;
        scope.passphrase = '';
        scope.callback = callback;
        modal = $modal({
          template: 'views/modal.passphrase.html',
          backdrop: 'static',
          keyboard: false,
          scope: scope
        });
        modal.$promise.then(null, function () {
          callback();
        });
      };

      dev.callbacks.button = function (code) {
        var scope = $rootScope.$new(),
            modal;
        scope.code = code;
        modal = $modal({
          template: 'views/modal.button.html',
          backdrop: 'static',
          keyboard: false,
          scope: scope
        });
        dev.callbacks.receive = function () {
          dev.callbacks.receive = null;
          modal.destroy();
        };
        dev.callbacks.error = function () {
          dev.callbacks.error = null;
          modal.destroy();
        };
      };

      dev.callbacks.word = function (callback) {
        $rootScope.seedWord = '';
        $rootScope.wordCallback = function (word) {
          $rootScope.wordCallback = null;
          $rootScope.seedWord = '';
          callback(word);
        };
      };

      dev.callbacks.outdatedFirmware = function (firmware) {
        var scope = $rootScope.$new(),
            modal;
        scope.firmware = firmware;
        modal = $modal({
          template: 'views/modal.firmware.html',
          backdrop: 'static',
          keyboard: false,
          scope: scope
        });
      };

    }

    // marks a device of the given descriptor as disconnected
    function disconnect(desc) {
      var dev = utils.find(self.devices, desc, compareById);

      if (dev)
        dev.disconnect();
    }

    // maps a promise notifications with connected device descriptors
    function progressWithConnected(pr) {
      return pr.then(null, null, function () { // ignores the value
        return trezor.devices();
      });
    }

    // maps a promise notifications with a delta between the current and
    // previous device descriptors
    function progressWithDescriptorDelta(pr) {
      var prev = [],
          tmp;

      return pr.then(null, null, function (curr) {
        tmp = prev;
        prev = curr;
        return descriptorDelta(tmp, curr);
      });
    }

    // computes added and removed device descriptors in current tick
    function descriptorDelta(xs, ys) {
      return {
        added: utils.difference(ys, xs, compareById),
        removed: utils.difference(xs, ys, compareById)
      };
    }

    // compare two objects by id
    function compareById(a, b) { return a.id === b.id; }

    // compares a dev with an id
    function compareDeviceWithId(d, id) { return d.id === id; }

  });
