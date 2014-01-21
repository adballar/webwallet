'use strict';

angular.module('webwalletApp')
  .factory('TrezorDevice', function (trezor, utils, TrezorAccount, $q) {

    function TrezorDevice(id) {
      this.id = id;
      this.accounts = [];
      this.features = null;
      this.node = null;
      this._desc = null;
      this._session = null;
      this._loading = null;
    }

    TrezorDevice.deserialize = function (data) {
      var dev = new TrezorDevice(data.id);

      dev.node = data.node;
      dev.features = data.features;
      dev.accounts = data.accounts.map(function (item) {
        return TrezorAccount.deserialize(item);
      });

      return dev;
    };

    TrezorDevice.prototype.serialize = function () {
      return {
        id: this.id,
        node: this.node,
        features: this.features,
        accounts: this.accounts.map(function (acc) {
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

    TrezorDevice.prototype.connect = function (desc) {
      this._desc = desc;
      this._session = trezor.open(this._desc);
    };

    TrezorDevice.prototype.disconnect = function () {
      this._session.close();
      this._session = null;
      this._desc = null;
    };

    TrezorDevice.prototype.hasKey = function () {
      return !!this.node;
    };

    TrezorDevice.prototype.initialize = function () {
      var self = this,
          delay = 3000, // delay between attempts
          max = 60; // give up after n attempts

      return self._withLoading(function () {
        return utils.endure(initialize, delay, max) // keep trying to initialize
          .then(function (res) { // setup features data
            self.features = res.message;
          })
          .then(getPublicKey)
          .then(function (res) { // setup master node
            self.node = res.message.node;
          });
      });

      function initialize() {
        if (self._session) // returns falsey to cancel the trapolining
          return self._session.initialize();
      }

      function getPublicKey() {
        return self._session.getPublicKey();
      }
    };

    TrezorDevice.prototype.refresh = function () {
      this.accounts.forEach(function (acc) {
        acc.reqBalance();
        acc.reqTransactions();
      });
    };

    TrezorDevice.prototype.subscribe = function () {
      this.accounts.forEach(function (acc) {
        acc.subscribe();
      });
    };

    TrezorDevice.prototype.unsubscribe = function () {
      this.accounts.forEach(function (acc) {
        acc.unsubscribe();
      });
    };

    TrezorDevice.prototype.addAccount = function () {
      var id = this.accounts.length,
          acc = this.createAccount(id);

      this.accounts.push(acc);
      acc.reqRegister().then(function () {
        acc.reqBalance();
        acc.reqTransactions();
      });
    };

    TrezorDevice.prototype.createAccount = function (id) {
      var master = this.node,
          accNode = trezor.deriveChildNode(master, id),
          coinNode = trezor.deriveChildNode(accNode, 0), // = bitcoin
          coin = 'BTC';

      return new TrezorAccount(''+id, coin,
        trezor.deriveChildNode(coinNode, 0), // normal adresses
        trezor.deriveChildNode(coinNode, 1) // change addresses
      );
    };

    TrezorDevice.prototype.reset = function (settings) {
      var sett = angular.copy(settings);

      if (sett.label)
        sett.label = utils.str2hex(sett.label.trim());

      return this._session.resetDevice(sett);
    };

    TrezorDevice.prototype.loadByXprv = function (settings) {
      var sett = angular.copy(settings);

      if (sett.xprv)
        sett.node = utils.xprv2node(sett.xprv);
      delete sett.xprv;

      if (sett.label)
        sett.label = utils.str2hex(sett.label.trim());

      return this._session.loadDevice(sett);
    };

    TrezorDevice.prototype._withLoading = function (fn) {
      var self = this;

      start();
      return fn().then(end, end);

      function start() { self._loading = true; }
      function end() { self._loading = false; }
    };

    return TrezorDevice;

  });
