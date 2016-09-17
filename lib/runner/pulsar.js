var events = require('events');
var util = require('util');
var _ = require('underscore');
var async = require('async');

module.exports = (function() {

  /**
   * @param {Object} db
   * @param {Object} config
   * @constructor
   */
  var RunnerPulsar = function(db, config) {
    events.EventEmitter.call(this);
  };

  util.inherits(RunnerPulsar, events.EventEmitter);

  return RunnerPulsar;

})();