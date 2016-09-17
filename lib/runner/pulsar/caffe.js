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
  var RunnerPulsarCaffe = function(db, config) {
    events.EventEmitter.call(this);
  };

  util.inherits(RunnerPulsarCaffe, events.EventEmitter);

  return RunnerPulsarCaffe;

})();
