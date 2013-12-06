'use strict';

angular.module('webwalletApp')
  .factory('DeviceAccount', function (utils) {

  	function DeviceAccount(settings) {
  		this.settings = settings;
  		this.label = null;
  		this.ballance = null;
  		this.transactions = null;
  	}

  	return DeviceAccount;

  });
