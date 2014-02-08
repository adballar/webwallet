'use strict';

// jshint curly:false, camelcase:false, latedef:nofunc

angular.module('webwalletApp')
  .factory('TrezorAccount', function (utils, trezor, backendService,
      Crypto, BigInteger, Bitcoin, $q) {

    function TrezorAccount(id, coin, node, changeNode) {
      this.id = id;
      this.coin = coin;
      this.node = node;
      this.changeNode = changeNode;
      this.transactions = null;
      this.balance = null;
      this.utxos = null;

      this._feePerKb = 10000;

      this._wallet = new Bitcoin.Wallet();
      this._subscriptions = { primary: null, change: null };
      this._offsets = { primary: null, change: null };
      this._utxos = { primary: null, change: null };
      this._txs = { primary: null, change: null };
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
      var index = this._offsets.primary + n,
          child = trezor.deriveChildNode(this.node, index),
          address = utils.node2address(child, this.coin.address_type);

      return {
        path: child.path,
        address: address,
        index: index
      };
    };

    TrezorAccount.prototype.usedAddresses = function () {
      // TODO: rewrite this completely when we get rid if Bitcoin.Transaction
      var self = this,
          ret;

      // credit outputs
      ret = self.transactions.filter(function (tx) {
        return tx.analysis && tx.analysis.type === 'recv';
      });

      // zip with summed matching utxos
      ret = ret.map(function (tx) {
        // TODO: consider taking utxos directly from the tx by looking up in
        // the wallet, instead of loading from the balance
        var utxos, balance;

        utxos = self.utxos.filter(function (utxo) {
          return utxo.transactionHash === tx.hash;
        });

        balance = utxos.reduce(function (bal, utxo) {
          var val = utxo.value.toString();
          return bal.add(new BigInteger(val));
        }, BigInteger.ZERO);

        return {
          path: utxos[0] ? utxos[0].path : null,
          address: tx.analysis.addr.toString(),
          balance: balance
        };
      });

      // sort by address
      ret = ret.sort(function (a, b) {
        if (a.address > b.address)
          return 1;
        if (a.address < b.address)
          return -1;
        return 0;
      });

      // aggregate by address, sum balances
      ret = ret.reduce(function (xs, x) {
        var prev = xs[xs.length - 1];
        if (prev && prev.address === x.address)
          prev.balance = prev.balance.add(x.balance);
        else
          xs.push(x);
        return xs;
      }, []);

      return ret;
    };

    TrezorAccount.prototype.sendTx = function (tx, device) {
      var self = this,
          txs;

      // lookup txs referenced by inputs
      txs = tx.inputs.map(function (inp) {
        var hash = inp.prev_hash,
            node = [self.node, self.changeNode]
              [inp.address_n[inp.address_n.length-2]]; // TODO: HACK!
        return backendService.lookupTx(node, hash);
      });

      // convert to trezor structures
      txs = $q.all(txs).then(function (txs) {
        return txs.map(function (res) {
          var tx = res.data;
          return {
            version: tx.version,
            inputs: tx.inputs.map(function (inp) {
              var val = {
                prev_hash: inp.sourceHash,
                prev_index: inp.ix,
                script_sig: Crypto.util.bytesToHex(
                  Crypto.util.base64ToBytes(inp.script)),
              };
              if (inp.sequence > 0)
                val.sequence = inp.sequence;
              return val;
            }),
            outputs: tx.outputs.map(function (out) {
              return {
                amount: out.value,
                script_pubkey: Crypto.util.bytesToHex(
                  Crypto.util.base64ToBytes(out.script))
              };
            })
          };
        });
      });

      // sign by device
      return txs.then(function (txs) {
        return device.signTx(tx, txs).then(function (res) {
          var message = res.message,
              serializedTx = message.serialized_tx;
          return backendService.send(serializedTx);
        });
      });
    };

    TrezorAccount.prototype.buildTx = function (address, amount, device) {
      var self = this;

      return buildTx(0);

      function buildTx(feeAttempt) {
        var tx = self._constructTx(address, amount, feeAttempt);

        return device.measureTx(tx).then(function (res) {
          var bytes = parseInt(res.message.tx_size, 10),
              kbytes = Math.ceil(bytes / 1000),
              space = tx.total - amount,
              fee = kbytes * self._feePerKb;

          if (space - fee < 5430) { // there is no need for a change address
            delete tx.outputs[1];
            tx.outputs.length = 1;
            tx.fee = fee;
            return tx;
          }

          if (fee < space) { // we have a space for the fee, set it and return
            tx.outputs[1].amount = space - fee;
            tx.fee = fee;
            return tx;
          }

          return buildTx(fee); // try again with more inputs
        });
      }
    };

    TrezorAccount.prototype._constructTx = function (address, amount, fee) {
      var tx = {},
          utxos = this._selectUtxos(amount + fee),
          chnode = this.changeNode,
          choffset = this._offsets.change,
          chpath = chnode.path.concat([choffset]),
          total, change;

      total = utxos.reduce(function (val, utxo) {return val + utxo.value;}, 0);
      change = total - amount - fee;

      tx.fee = fee;
      tx.total = total;
      tx.inputs = utxos.map(function (utxo) {
        return {
          prev_hash: utxo.transactionHash,
          prev_index: utxo.ix,
          address_n: utxo.path
        };
      });
      tx.outputs = [
        { // primary output
          address: address,
          amount: amount,
          script_type: 'PAYTOADDRESS'
        },
        { // change output
          address_n: chpath,
          amount: change,
          script_type: 'PAYTOADDRESS'
        }
      ];

      return tx;
    };

    // selects utxos for a tx
    // with a block hash first, smallest first
    TrezorAccount.prototype._selectUtxos = function (amount) {
      var self = this,
          utxos = this.utxos.slice(),
          ret = [],
          retval = 0,
          i;

      utxos = utxos.sort(function (a, b) { // sort in reverse
        var txa = self._wallet.txIndex[a.transactionHash],
            txb = self._wallet.txIndex[b.transactionHash],
            hba = !!txa.block,
            hbb = !!txb.block,
            hd = hbb - hba,
            vd = b.value - a.value;
        return hd !== 0 ? hd : vd;
      });

      for (i = 0; i < utxos.length && retval < amount; i++) {
        ret.push(utxos[i]);
        retval += utxos[i].value;
      }

      return ret;
    };

    // Backend communication

    TrezorAccount.prototype.register = function () {
      var pr1 = backendService.register(this.node),
          pr2 = backendService.register(this.changeNode);

      return $q.all([pr1, pr2]);
    };

    TrezorAccount.prototype.deregister = function () {
      var pr1 = backendService.deregister(this.node),
          pr2 = backendService.deregister(this.changeNode);

      return $q.all([pr1, pr2]);
    };

    TrezorAccount.prototype.subscribe = function () {
      this._subscriptions.primary = this._subscribeToNode(this.node, 'primary');
      this._subscriptions.change = this._subscribeToNode(this.changeNode, 'change');
    };

    TrezorAccount.prototype.unsubscribe = function () {
      var k;

      for (k in this._subscriptions) {
        if (this._subscriptions.hasOwnProperty(k) && this._subscriptions[k]) {
          this._subscriptions[k].unsubscribe();
          this._subscriptions[k] = null;
        }
      }
    };

    TrezorAccount.prototype.loadPrimaryTxs = function () {
      return backendService.transactions(this.node).then(function (res) {
        return res.data;
      });
    };

    TrezorAccount.prototype._subscribeToNode = function (node, dataKey) {
      var self = this,
          loadingTxs = false;

      return backendService.subscribe(node, function (data) {
        if (data.status === 'PENDING') // ignore pending data
          return;

        // balance update processing
        self._utxos[dataKey] = self._constructUtxos(data, node.path);
        self._rollupUtxos();

        // load transactions on any balance update
        if (!loadingTxs) {
          loadingTxs = true;
          backendService.transactions(node)
            .then(function (res) {
              self._txs[dataKey] = self._constructTxs(res.data, node.path);
              self._rollupTxs();
              loadingTxs = false;
            }, function () {
              loadingTxs = false;
            });
        }
      });
    };

    TrezorAccount.prototype._rollupUtxos = function () {
      var utxos = this._utxos;
      if (utxos.primary && utxos.change) {
        this.utxos = utxos.primary.concat(utxos.change);
        this.balance = this._constructBalance(this.utxos);
      }
    };

    TrezorAccount.prototype._rollupTxs = function () {
      var txs = this._txs;
      if (txs.primary && txs.change) {
        this.transactions = txs.primary.concat(txs.change);
        this.transactions = this._mergeTxs(this.transactions);
        this.transactions = this._indexTxs(this.transactions, this._wallet);
        this._offsets.primary = this._incrementOffset(txs.primary, this._offsets.primary || 0);
        this._offsets.change = this._incrementOffset(txs.change, this._offsets.change || 0);
      }
    };

    TrezorAccount.prototype._constructBalance = function (utxos) {
      return utxos.reduce(function (bal, txo) {
        return bal.add(new BigInteger(txo.value.toString()));
      }, BigInteger.ZERO);
    };

    TrezorAccount.prototype._constructUtxos = function (details, basePath) {
      return [
        details.confirmed, details.change, details.receiving
      ].reduce(function (utxos, x) {
        return utxos.concat(x);
      }).map(function (utxo) {
        utxo.path = basePath.concat([utxo.addressId]);
        return utxo;
      });
    };

    TrezorAccount.prototype._constructTxs = function (txs, basePath) {
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
          path: out.addressId != null ? basePath.concat([out.addressId]) : null
        });
      }
    };

    TrezorAccount.prototype._incrementOffset = function (txs, offset) {
      txs.forEach(function (tx) {
        tx.outs
          .filter(function (out) {return out.path;})
          .forEach(function (out) {
            var id = out.path[out.path.length-1];
            if (id >= offset)
              offset = id + 1;
          });
      });
      return offset;
    };

    TrezorAccount.prototype._mergeTxs = function (txs) {
      txs.sort(hashCmp);
      return txs.reduce(merge, []);

      function merge(txs, tx) {
        var prev = txs[txs.length - 1];
        if (prev && prev.hash === tx.hash) {
          tx.outs.forEach(function (out, i) {
            if (out.path != null)
              prev.outs[i].path = out.path;
          });
        } else
          txs.push(tx);
        return txs;
      }

      function hashCmp(a, b) {
        if (a.hash > b.hash) return 1;
        if (a.hash < b.hash) return -1;
        return 0;
      }
    };

    TrezorAccount.prototype._indexTxs = function (txs, wallet) {
      txs.forEach(index);
      txs.forEach(analyze);
      txs.sort(timestampCmp);
      txs.reduceRight(balance, null);

      return txs;

      function index(tx) {
        if (wallet.txIndex[tx.hash]) return;
        wallet.txIndex[tx.hash] = tx; // index tx by hash
        tx.outs
          .filter(function (out) {return out.path;})
          .forEach(function (out) { // register sendable outputs
            var hash = Crypto.util.bytesToBase64(
              out.script.simpleOutPubKeyHash());
            wallet.addressHashes.push(hash);
          });
      }

      function analyze(tx) {
        if (tx.analysis) return;
        try {
          tx.analysis = tx.analyze(wallet);
        } catch (e) {
          tx.analysis = null;
        }
      }

      function balance(prev, curr) {
        var sign, val;
        if (!curr.analysis) return prev;
        sign = new BigInteger(curr.analysis.impact.sign.toString());
        val = curr.analysis.impact.value.multiply(sign);
        curr.balance = val.add(prev ? prev.balance : BigInteger.ZERO);
        return curr;
      }

      function timestampCmp(a, b) { // compares in reverse
        var ta = +a.timestamp,
            tb = +b.timestamp;
        if (!ta) return -1;
        if (!tb) return 1;
        if (ta > tb) return -1;
        if (ta < tb) return 1;
        return 0;
      }
    };

    function TrezorTransactionOut(data) {
      Bitcoin.TransactionOut.call(this, data);
      this.index = data.index;
      this.path = data.path;
    }

    TrezorTransactionOut.prototype = Object.create(Bitcoin.TransactionOut.prototype);

    TrezorTransactionOut.prototype.clone = function () {
      var val = Bitcoin.TransactionOut.clone.call(this);
      val.index = this.index;
      val.path = this.path;
      return val;
    };

    return TrezorAccount;

  });
