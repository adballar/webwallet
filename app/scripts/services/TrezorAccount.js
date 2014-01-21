'use strict';

angular.module('webwalletApp')
  .factory('TrezorAccount', function (utils, trezor, backendService, Bitcoin, $q) {

    function TrezorAccount(id, coin, node, changeNode) {
      this.id = id;
      this.coin = coin;
      this.node = node;
      this.changeNode = changeNode;
      this.balance = null;
      this.transactions = null;
      this._wallet = new Bitcoin.Wallet();
    }

    TrezorAccount.deserialize = function (data) {
      return new TrezorAccount(
        data.id,
        data.coin,
        data.node,
        data.changeNode
      );
    };

    TrezorAccount.prototype.serialize = function () {
      return {
        id: this.id,
        coin: this.coin,
        node: this.node,
        changeNode: this.changeNode
      };
    };

    TrezorAccount.prototype.label = function () {
      var n = +this.id + 1;
      return 'Account #' + n;
    };

    TrezorAccount.prototype.address = function (n) {
      var child = trezor.deriveChildNode(this.node, n),
          address = utils.node2address(child, 'testnet'); // TODO: proper address type

      return address;
    };

    TrezorAccount.prototype.addresses = function (n) {
      var offset = 0, // TODO: proper offset
          addr = [],
          i;

      for (i = offset; i < offset + n; i++)
        addr.push(this.address(i));

      return addr;
    };

    TrezorAccount.prototype.subscribe = function () {
      var self = this;

      this._socket = backendService.subscribe(this.node, process);
      this._changeSocket = backendService.subscribe(this.changeNode, process);

      function process(data) {
        console.log(data);
      }
    };

    TrezorAccount.prototype.unsubscribe = function () {
      if (this._socket) this._socket.unsubscribe();
      if (this._changeSocket) this._changeSocket.unsubscribe();
    };

    TrezorAccount.prototype.reqRegister = function () {
      var self = this,
          pr1 = backendService.register(this.node),
          pr2 = backendService.register(this.changeNode);

      return $q.all([pr1, pr2]);
    };

    TrezorAccount.prototype.reqBalance = function () {
      var self = this,
          pr1 = backendService.balance(this.node),
          pr2 = backendService.balance(this.changeNode);

      return $q.all([pr1, pr2])
        .then(function (res) {
          var b1 = self._constructBalance(res[0].data),
              b2 = self._constructBalance(res[1].data);
          self.balance = b1.add(b2);
        });
    };

    TrezorAccount.prototype.reqTransactions = function () {
      var self = this,
          pr1 = backendService.transactions(this.node),
          pr2 = backendService.transactions(this.changeNode);

      return $q.all([pr1, pr2])
        .then(function (res) {
          return res[0].data.concat(res[1].data);
        })
        .then(function (txs) {
          self.transactions = self._constructTransactions(txs);
          self._indexTransactions(self.transactions, self._wallet);
        });
    };

    TrezorAccount.prototype._constructBalance = function (details) {
      var tx, i, ib, b = BigInteger.ZERO;

      if (!details)
        return null;

      for (i = 0; i < details.confirmed.length; i++) {
        tx = details.confirmed[i];
        ib = new BigInteger(tx.value.toString());
        b = b.add(ib);
      }

      return b;
    };

    TrezorAccount.prototype._constructTransactions = function (txs) {
      return txs.map(transaction);

      function transaction(tx) {
        var ret = new Bitcoin.Transaction({
          hash: tx.hash,
          version: tx.version,
          lock_time: tx.lockTime,
          timestamp: tx.height, // TODO: use real timestamp
          block: tx.blockHash
        });
        ret.ins = tx.inputs.map(input);
        ret.outs = tx.outputs.map(output);
        return ret;
      }

      function input(inp) {
        return new Bitcoin.TransactionIn({
          outpoint: {
            hash: inp.sourceHash,
            index: inp.ix
          },
          script: inp.script,
          sequence: inp.sequence
        });
      }

      function output(out) {
        return new TrezorTransactionOut({
          script: out.script,
          value: out.value.toString(),
          index: out.ix,
          addressId: out.addressId
        });
      }
    };

    TrezorAccount.prototype._indexTransactions = function (txs, wallet) {
      txs.forEach(index);
      txs.forEach(analyze);
      txs.sort(cmp);
      txs.reduce(balance, null);
      txs.reverse();

      function index(tx) {
        wallet.txIndex[tx.hash] = tx; // index tx by hash
        tx.outs.forEach(function (out) { // register known addresses
          var hash;
          if (out.addressId == null)
            return;
          hash = out.script.simpleOutPubKeyHash();
          hash = Crypto.util.bytesToBase64(hash);
          wallet.addressHashes.push(hash);
        });
      }

      function analyze(tx) {
        try {
          tx.analysis = tx.analyze(wallet);
        } catch (e) {
          tx.analysis = null;
        }
      }

      function balance(prev, curr) {
        if (!curr.analysis) return prev;
        curr.balance = curr.analysis.impact.value.add(
          prev ? prev.balance : BigInteger.ZERO);
        return curr;
      }

      function cmp(a, b) { // compares in reverse
        if (a.timestamp < b.timestamp) return 1;
        if (a.timestamp > b.timestamp) return -1;
        return 0;
      }
    };

    function TrezorTransactionOut(data) {
      Bitcoin.TransactionOut.call(this, data);
      this.addressId = data.addressId;
      this.index = data.index;
    }

    TrezorTransactionOut.prototype = Object.create(Bitcoin.TransactionOut.prototype);

    TrezorTransactionOut.prototype.clone = function () {
      var val = Bitcoin.TransactionOut.clone.call(this);
      val.addressId = this.addressId;
      val.index = this.index;
      return val;
    };

    return TrezorAccount;

  });
