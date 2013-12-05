'use strict';

angular.module('webwalletApp')
	.service('utils', function Utils($interval, $timeout) {

		//
		// promise utils
		//

		// returns a promise that gets notified every n msec
		function tick(n) {
			return $interval(null, n);
		}

		// keeps calling fn while the returned promise is being rejected
		// if given delay, waits for delay msec before calling again
		// if given max, gives up after max attempts and rejects with
		// the latest error
		function endure(fn, delay, max) {
			return fn().then(null, function (err) {

				if (max !== undefined && max < 1) // we have no attempt left
					throw err;

				var retry = function () {
					return endure(fn, delay, max ? max - 1 : max);
				};

				return $timeout(retry, delay); // retry after delay
			});
		}

		this.tick = tick;
		this.endure = endure;

		//
		// collection utils
		//

		// finds index of item in an array using a comparator fn
		// returns -1 if not found
		function findIndex(xs, x, fn) {
			var i;

			for (i = 0; i < xs.length; i++)
				if (fn(xs[i], x))
					return i;

			return -1;
		}

		// like findIndex, but returns the array item
		// returns undefined if not found
		function find(xs, x, fn) {
			var idx = findIndex(xs, x, fn);
			if (idx < 0) return;
			return xs[idx];
		}

		// filters an array using a predicate fn
		function filter(xs, fn) {
			var ys = [],
					i;

			for (i = 0; i < xs.length; i++)
				if (fn(xs[i]))
					ys.push(xs[i]);

			return ys;
		}

		// returns items from xs that are missing in ys using a comparator fn
		function difference(xs, ys, fn) {
			return filter(xs, function (x) {
				return find(ys, x, fn) === undefined;
			});
		}

		this.findIndex = findIndex;
		this.find = find;
		this.filter = filter;
		this.difference = difference;

	});