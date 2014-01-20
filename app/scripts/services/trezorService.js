'use strict';

angular.module('webwalletApp')
  .service('trezorService', function TrezorService(utils, storage, trezor, TrezorDevice, $q, $rootScope) {

    var self = this,
        STORAGE_DEVICES = 'trezorServiceDevices';

    self.get = getDevice;
    self.forget = forgetDevice;
    self.devices = deserialize(restore()); // the list of available devices

    storeWhenChanged();
    keepRefreshing(1000);

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

    // starts auto-refreshing the device list
    function keepRefreshing(n) {
      var tick = utils.tick(n),
          desc = progressWithConnected(tick),
          delta = progressWithDescriptorDelta(desc);

      // handle added/removed devices
      delta.then(null, null, function (dd) {
        dd.added.forEach(connect);
        dd.removed.forEach(disconnect);
      });
    }

    // marks the device of the given descriptor as connected, adding it to the
    // device list if not present and loading it
    function connect(desc) {
      var dev = utils.find(self.devices, desc, compareById);

      if (!dev) {
        dev = new TrezorDevice(desc.id);
        self.devices.push(dev);
      }

      if (!dev.is('connected')) {
        dev.connect(desc);
        dev.initialize().then(function () {
          dev.refresh();
        });
      }
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
