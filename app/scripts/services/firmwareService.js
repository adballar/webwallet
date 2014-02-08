'use strict';

// jshint curly:false, camelcase:false, latedef:nofunc

angular.module('webwalletApp')
  .value('firmwareListUrl', '/data/firmware.json')
  .service('firmwareService', function FirmwareService(firmwareListUrl, $http) {

    var self = this;

    self.check = check;
    self.download = download;
    self.firmwareList = $http.get(firmwareListUrl);

    function check(features) {
      return self.firmwareList.then(function (res) {
        return pick(features, res.data);
      });
    }

    function download(firmware) {
      return $http.get(firmware.url).then(function (res) {
        return res.data;
      });
    }

    // Private

    function pick(features, list) {
      var firmware = list[0],
          i;

      if (!firmware) // no firmware available
        return;

      if (versionCmp(firmware, features) < 1) // features are up to date
        return;

      for (i = 0; i < list.length; i++) { // collect required flags
        if (versionCmp(list[i], features) === 0)
          break;
        if (list[i].required) {
          firmware.required = true;
          break;
        }
      }

      return firmware;
    }

    function versionCmp(a, b) {
      var major = a.major_version - b.major_version,
          minor = a.minor_version - b.minor_version,
          bugfix = a.bugfix_version - b.bugfix_version;
      if (major) return major;
      if (minor) return minor;
      if (bugfix) return bugfix;
    }

  });