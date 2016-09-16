var _ = require('underscore');
var shellwords = require('shellwords');
var spawn = require('child_process').spawn;

module.exports = (function() {

  /**
   *
   * @param {Object} args
   * @param {String} args.app
   * @param {String} args.env
   * @param {String} [args.task]
   * @param {Array} [args.lenrOptions]
   * @param {Array} [args.capistranoOptions]
   * @constructor
   */
  function LenrExec(args) {
    var defaults = {
      task: null,
      lenrOptions: [],
      capistranoOptions: []
    };
    args = _.defaults({}, args, defaults);
    LenrExec.validate(args);
    this._args = args;
  }

  LenrExec.validate = function(args) {
    var errors = [].concat(
      LenrExec._validateRequired(args.app, 'app'),
      LenrExec._validateRequired(args.env, 'env'),
      LenrExec._validateLenrOptions(args.lenrOptions)
    );
    if (errors.length) {
      throw new ValidationError(errors.join('; '));
    }
  };

  LenrExec._validateRequired = function(field, fieldName) {
    if (!field || !_.isString(field) || !field.trim()) {
      return '[' + fieldName + '] param must be not empty string to create Lenr Command';
    }
    return [];
  };

  LenrExec._validateLenrOptions = function(lenrOptions) {
    var errors = [];
    for (var i = lenrOptions.length - 1; i >= 0; i--) {
      try {
        var opt = shellwords.split(lenrOptions[i]);
        if (opt.length > 2) {
          errors.push('Lenr option [' + lenrOptions[i] + '] can\'t have more than two(2) parts');
        }
        if (opt[0].charAt(0) !== '-') {
          errors.push('Lenr option [' + lenrOptions[i] + '] must have dash(-) or double-dash(--) prefix.');
        }
      } catch (err) {
        errors.push(lenrOptions[i] + ' has error: ' + err.message);
      }
    }
    return errors;
  };

  LenrExec.prototype.getArgs = function() {
    return this._args;
  };

  LenrExec.prototype.getCommandArgs = function() {
    var args = [];
    var lenrOptions = this._parseOptions(this._args.lenrOptions);
    args = args.concat(lenrOptions, this.getCapistranoCommandArgs());
    return _.without(args, null);
  };

  LenrExec.prototype.getCapistranoCommandArgs = function() {
    var options = this._parseOptions(this._args.capistranoOptions);
    return [this._args.app, this._args.env, this._args.task].concat(options);
  };

  LenrExec.prototype._parseOptions = function(options) {
    return _.reduce(options, function(memo, opt) {
      return memo.concat(shellwords.split(opt));
    }, []);
  };

  LenrExec.prototype.run = function() {
    return spawn('lenr', this.getCommandArgs());
  };

  LenrExec.prototype.toString = function() {
    return 'lenr ' + this.getCommandArgs().join(' ');
  };

  return LenrExec;
}());
