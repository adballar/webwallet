'use strict';

angular.module('webwalletApp')
  .factory('TrezorDevice', function (trezor, utils, TrezorAccount, $q) {

    function TrezorDevice(id) {
      this.id = id;
      this.accounts = [];
      this.features = null;
      this.node = null;
      this._desc = null;
      this._loading = null;
      this._session = null;
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
      this._desc = null;
    };

    TrezorDevice.prototype.hasKey = function () {
      return this.features && this.features.mpk_hash;
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
        return self._withSession().then(function (ses) {
          return ses.initialize();
        });
      }

      function getPublicKey() {
        return self._withSession().then(function (ses) {
          return ses.getPublicKey();
        });
      }
    };

    TrezorDevice.prototype.refresh = function () {
      this.accounts.forEach(function (account) {
        account.reqBalance();
        account.reqTransactions();
      });
    };

    TrezorDevice.prototype.addAccount = function () {
      var id = this.accounts.length,
          account = this.createAccount(id);

      this.accounts.push(account);
      account.reqRegister().then(function () {
        account.reqBalance();
        account.reqTransactions();
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
      return this._withSession().then(function (ses) {
        var sett = angular.copy(settings);

        if (sett.label)
          sett.label = utils.str2hex(sett.label.trim());

        return ses.resetDevice(sett);
      });
    };

    TrezorDevice.prototype.loadByXprv = function (settings) {
      return this._withSession().then(function (ses) {
        var sett = angular.copy(settings);

        if (sett.xprv)
          sett.node = utils.xprv2node(sett.xprv);
        delete sett.xprv;

        if (sett.label)
          sett.label = utils.str2hex(sett.label.trim());

        return ses.loadDevice(sett);
      });
    };

    TrezorDevice.prototype._withLoading = function (fn) {
      var self = this;

      start();
      return fn().then(end, end);

      function start() { self._loading = true; }
      function end() { self._loading = false; }
    };

    TrezorDevice.prototype._withSession = function () {
      var dfd = $q.defer();
      dfd.resolve(this._session);
      return dfd.promise;
    };

    return TrezorDevice;

  });
