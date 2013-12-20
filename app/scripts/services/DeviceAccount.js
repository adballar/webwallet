'use strict';

angular.module('webwalletApp')
  .factory('DeviceAccount', function (utils) {

    function DeviceAccount(id) {
      this.id = id;
      this.label = null;
      this.ballance = null;
      this.addressCount = 10;
      this.cointype = 'BTC';
      this.transactions = [{
        date: new Date(),
        comment: 'xxx',
        address: 'XyXyXyXy',
        amount: 123,
        ballance: 123.1434
      }];
    }

    DeviceAccount.deserialize = function (data) {
      var acc = new DeviceAccount();

      acc.id = data.id;
      acc.label = data.label || null;

      return acc;
    };

    DeviceAccount.prototype.serialize = function () {
      return {
        id: this.id,
        label: this.label
      };
    };

    DeviceAccount.prototype.addresses = function () {
      var addresses = [],
          i;

      for (i = 0; i < this.addressCount; i++) {
        addresses.push(i);
      }

      return addresses;
    };

    return DeviceAccount;

  });
