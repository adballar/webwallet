'use strict';

angular.module('webwalletApp')
  .factory('TrezorDevice', function (trezor, utils, DeviceAccount, $q) {

    function TrezorDevice(serialNumber) {
      this.serialNumber = serialNumber;
      this.accounts = null;
      this.label = null;
      this._desc = null;
      this._features = null;
      this._loading = null;
      this._sessionPromise = null;
    }

    TrezorDevice.deserialize = function (data) {
      var dev = new TrezorDevice(data.serialNumber);

      dev.label = data.label;
      dev.accounts = (data.accounts || []).map(function (item) {
        return DeviceAccount.deserialize(item);
      });

      return dev;
    };

    TrezorDevice.prototype.serialize = function () {
      return {
        label: this.label,
        serialNumber: this.serialNumber,
        accounts: (this.accounts || []).map(function (acc) {
          return acc.serialize();
        })
      };
    };

    TrezorDevice.prototype.account = function (id) {
      return utils.find(this.accounts, id, function (account, id) {
        return account.id === id;
      });
    };

    TrezorDevice.prototype.status = function () {
      if (this._loading) return 'loading';
      if (this._desc) return 'connected';
      return 'disconnected';
    };

    TrezorDevice.prototype.is = function (status) {
      return this.status() === status;
    };

    TrezorDevice.prototype.initialized = function () {
      return this._features && this._features.mpk_hash;
    };

    TrezorDevice.prototype.connect = function (desc) {
      this._desc = desc;
    };

    TrezorDevice.prototype.disconnect = function () {
      this._closeSession();
      this._desc = null;
    };

    TrezorDevice.prototype.communicate = function () {
      return this._sessionPromise || (this._sessionPromise = this._openSession());
    };

    TrezorDevice.prototype.initialize = function () {
      var self = this,
          delay = 3000, // delay between attempts
          max = 60; // give up after n attempts

      self._loading = true;
      utils.endure(initialize, delay, max) // keep trying to initialize
        .then(
          function (result) {
            self._setup(result.message);
            self._loading = false;
          },
          function (err) {
            self._loading = false;
          });

      function initialize() {
        return self.communicate().then(function (session) {
          return session.initialize();
        });
      }
    };

    TrezorDevice.prototype._setup = function (features) {
      this._features = features;
      this.label = features.settings.label;
      this.accounts = [
        new DeviceAccount('1')
      ];
    };

    TrezorDevice.prototype._openSession = function () {
      var dfd = $q.defer(),
          self = this;

      trezor.open(this._desc, {
        openSuccess: function (session) {
          dfd.resolve(session);
        },
        openError: function (err) {
          dfd.reject(err);
          self._sessionPromise = null;
        },
        close: function () {
          self._sessionPromise = null; // re-open session on next attempt
        }
      });

      return dfd.promise;
    };

    TrezorDevice.prototype._closeSession = function () {
      if (this._sessionPromise)
        this._sessionPromise.then(function (session) {
          session.close();
        });
    };

    return TrezorDevice;

  });
