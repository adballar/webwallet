'use strict';

// jshint curly:false, camelcase:false, latedef:nofunc

angular.module('webwalletApp')
  .factory('TrezorDevice', function (trezor, utils, firmwareService, TrezorAccount) {

    function TrezorDevice(id) {
      this.id = id;
      this.accounts = [];
      this.callbacks = {}; // pin, passphrase callbacks
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

    TrezorDevice.prototype.label = function () {
      if (this.features && this.features.label)
        return utils.hex2str(this.features.label);
      else
        return 'My TREZOR';
    };

    TrezorDevice.prototype.connect = function (desc) {
      this._desc = desc;
      this._session = trezor.open(this._desc, this.callbacks);
    };

    TrezorDevice.prototype.disconnect = function () {
      if (this._session)
        this._session.close();
      this._session = null;
      this._desc = null;
    };

    TrezorDevice.prototype.hasKey = function () {
      return this.features && this.node;
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
          .then(function () { // check firmware version
            return firmwareService.check(self.features);
          })
          .then(function (firmware) {
            if (!firmware) return; // firmware is up to date
            self.callbacks.outdatedFirmware(firmware);
          })
          .then(getPublicKey)
          .then(
            function (res) { // setup master node
              self.node = res.message.node;
              self.node.path = [];
            },
            function () {
              self.node = null;
              self.accounts = [];
            }
          );
      });

      function initialize() {
        if (self._session) // returns falsey to cancel the trapolining
          return self._session.initialize();
      }

      function getPublicKey() {
        if (self.features.initialized)
          return self._session.getPublicKey();
        else
          throw new Error('Device not initialized');
      }
    };

    TrezorDevice.prototype.initializeAndLoadAccounts = function () {
      var self = this;

      self.initialize().then(function () {
        if (!self.hasKey()) return;
        if (self.accounts.length)
          self.subscribe();
        else {
          self.addAccount(); // always start with at least one account
          self.discoverAccounts(); // discover additional accounts that have ballances
        }
      });
    };

    TrezorDevice.prototype.subscribe = function () {
      this.accounts.forEach(function (acc) {
        acc.register().then(function () {
          acc.subscribe();
        });
      });
    };

    TrezorDevice.prototype.unsubscribe = function (deregister) {
      this.accounts.forEach(function (acc) {
        acc.unsubscribe();
        if (deregister) acc.deregister();
      });
    };

    TrezorDevice.prototype.addAccount = function () {
      var id = this.accounts.length,
          acc = this.createAccount(id);

      this.accounts.push(acc);
      return acc.register().then(function () {
        acc.subscribe();
      });
    };

    TrezorDevice.prototype.createAccount = function (id) {
      var master = this.node,
          accNode = trezor.deriveChildNode(master, id),
          coinNode = trezor.deriveChildNode(accNode, 0), // = bitcoin
          coin = {
            // coin_name: 'Testnet',
            // coin_shortcut: 'TEST',
            // address_type: 111,
            coin_name: 'Bitcoin',
            coin_shortcut: 'BTC',
            address_type: 0,
          };

      return new TrezorAccount(''+id, coin,
        trezor.deriveChildNode(coinNode, 0), // normal adresses
        trezor.deriveChildNode(coinNode, 1) // change addresses
      );
    };

    TrezorDevice.prototype.discoverAccounts = function () {
      var self = this;

      return discover(this.accounts.length);

      function discover(n) {
        var acc = self.createAccount(n);
        return acc.register()
          .then(function () {
            return acc.loadPrimaryTxs();
          })
          .then(function (txs) {
            if (txs.length > 0) {
              acc.subscribe();
              self.accounts[n] = acc;
              return discover(n + 1);
            } else {
              acc.deregister();
            }
          });
      }
    };

    TrezorDevice.prototype.measureTx = function (tx) {
      return this._session.measureTx(tx.inputs, tx.outputs);
    };

    TrezorDevice.prototype.signTx = function (tx, refTxs) {
      return this._session.simpleSignTx(tx.inputs, tx.outputs, refTxs);
    };

    TrezorDevice.prototype.flash = function (firmware) {
      var self = this;

      return this._session.eraseFirmware().then(function () {
        return self._session.uploadFirmware(firmware);
      });
    };

    TrezorDevice.prototype.wipe = function () {
      var self = this;

      return this._session.wipeDevice().then(function () {
        self.unsubscribe();
        return self.initializeAndLoadAccounts();
      });
    };

    TrezorDevice.prototype.reset = function (settings) {
      var self = this,
          sett = angular.copy(settings);

      if (sett.label)
        sett.label = utils.str2hex(sett.label.trim());

      return this._session.resetDevice(sett).then(function () {
        self.unsubscribe();
        return self.initializeAndLoadAccounts();
      });
    };

    TrezorDevice.prototype.load = function (settings) {
      var self = this,
          sett = angular.copy(settings);

      try { // try to decode as xprv
        sett.node = utils.xprv2node(sett.payload);
      } catch (e) { // use as mnemonic on fail
        sett.mnemonic = sett.payload;
      }
      delete sett.payload;

      if (sett.label)
        sett.label = utils.str2hex(sett.label);

      return this._session.loadDevice(sett).then(function () {
        self.unsubscribe();
        return self.initializeAndLoadAccounts();
      });
    };

    TrezorDevice.prototype.recover = function (settings) {
      var self = this,
          sett = angular.copy(settings);

      if (sett.label)
        sett.label = utils.str2hex(sett.label);

      return this._session.recoverDevice(sett).then(function () {
        self.unsubscribe();
        return self.initializeAndLoadAccounts();
      });
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
