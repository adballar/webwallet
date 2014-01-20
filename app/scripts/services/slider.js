'use strict';

angular.module('webwalletApp')
  .directive('slider', function () {
    return {
      require: 'ngModel',
      link: function (scope, element, attr, ngModel) {
        element
          .on('slide', function (ev) {
            ngModel.$setViewValue(ev.value);
          })
          .trigger({
            type: 'slide',
            value: element.attr('data-slider-value')
          })
          .slider();
      }
    };
  });