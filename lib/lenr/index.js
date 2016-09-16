var LenrExec = require('./exec');
var LenrJob = require('./job');
var events = require('events');
var util = require('util');
var _ = require('underscore');
var async = require('async');
var shellwords = require('shellwords');
var getLog = require('../logger').getLog;

module.exports = (function() {

  /**
   * @param {Object} db
   * @param {Object} config
   * @constructor
   */
  var Lenr = function(db, config) {
    this.db = db;
    this.config = config || {};
    this.jobQueue = {};
    this._isShuttingDown = false;

    events.EventEmitter.call(this);
    this._enableGracefulShutdown();
  };

  util.inherits(Lenr, events.EventEmitter);

  Lenr.ILLEGAL_TASKS = ['invoke', 'shell'];

  /**
   * @callback Lenr~createJobCallback
   * @param {Error} error
   * @param {LenrJob} job
   */
  /**
   * @param {String} app
   * @param {String} env
   * @param {String} task
   * @param {Object} [taskVariables]
   * @param {Lenr~createJobCallback} callback
   */
  Lenr.prototype.createJob = function(app, env, task, taskVariables, callback) {
    if (!task || !_.isString(task) || !task.trim()) {
      throw new ValidationError('create lenr job requires a lenr task');
    }
    task = task.trim();
    if (_.contains(Lenr.ILLEGAL_TASKS, task)) {
      throw new ValidationError('Illegal lenr task');
    }
    var args = {
      app: app,
      env: env,
      task: task
    };
    if (taskVariables) {
      if (_.isFunction(taskVariables)) {
        callback = taskVariables;
      } else {
        this._validateTaskVariables(taskVariables);
        args.capistranoOptions = this._taskVariablesToCapistrano(taskVariables);
      }
    }
    var job = this._createJob(args);
    this._saveJob(job, callback);
  };

  /**
   * @param {String} jobId
   * @param {LenrDB~getJobCallback} callback
   */
  Lenr.prototype.getJob = function(jobId, callback) {
    if (this.jobQueue[jobId]) {
      return callback(null, this.jobQueue[jobId]);
    }
    this.db.getJob(jobId, callback);
  };

  /**
   * @callback Lenr~getAvailableTasks
   * @param {Error} error
   * @param {Object.<string, string>} jobs, where key is task name and value is task description.
   */
  /**
   * @param {String} app
   * @param {String} env
   * @param {Lenr~getAvailableTasks} callback
   */
  Lenr.prototype.getAvailableTasks = function(app, env, callback) {
    var args = {
      app: app,
      env: env,
      capistranoOptions: ['-v', '--tasks']
    };
    var job = this._createJob(args);
    job.on('close', function() {
      if (job.status != LenrJob.STATUS.FINISHED) {
        return callback(new Error('Collecting of available tasks finished abnormally.\n' + job.output));
      }
      var regex = /cap\s([^\s]+)\s+#\s(.*)\n/g;
      var match;
      var jobs = {};
      while (null !== (match = regex.exec(job.stdout))) {
        jobs[match[1]] = match[2];
      }
      return callback(null, jobs);
    });
    job.execute();
  };

  /**
   * @see LenrDB.getJobList
   */
  Lenr.prototype.getJobList = function(callback, currentPage, pageSize) {
    return this.db.getJobList(callback, currentPage, pageSize);
  };

  /**
   * @returns {boolean}
   */
  Lenr.prototype.isShuttingDown = function() {
    return this._isShuttingDown;
  };

  /**
   * @param {LenrJob} job
   * @param {Function} callback
   */
  Lenr.prototype.restartJob = function(job, callback) {
    if (_.contains([LenrJob.STATUS.KILLED, LenrJob.STATUS.FAILED], job.status)) {
      getLog().debug('Job restart', {id: job.id});
      job.createInitialData();
      this._saveJob(job, function(err) {
        if (!err) {
          job.execute();
        }
        callback(err, job);
      });
    } else {
      throw new LenrError('You can restart only KILLED or FAILED jobs', 500);
    }
  };

  /**
   * @param {Object} args {@see LenrExec}
   * @param {Object} [data] {@see LenrExec}
   * @return {LenrJob} job
   */
  Lenr.prototype._createJob = function(args, data) {
    var job = new LenrJob(args, data);
    job._args.lenrOptions.push('--conf-repo ' + this.config.repo);
    if (this.config.branch) {
      job._args.lenrOptions.push('--conf-branch ' + this.config.branch);
    }
    return job;
  };

  /**
   * @param {Object} variables
   * @return {Object} validated variables formatted as required for capistranoOptions in constructor of LenrExec
   * @throws {ValidationError} if taskVariables contain incorrect options
   */
  Lenr.prototype._validateTaskVariables = function(variables) {
    if (!_.isObject(variables) || _.isArray(variables)) {
      throw new ValidationError('taskVariables must be the hash object');
    }
    //taskVariables are going to be '-s' capistrano options
    var errors = [];
    _.each(variables, function(value, key) {
      key = key.trim();
      if (key.indexOf(' ') !== -1 || key.indexOf('"') !== -1 || key.indexOf('\'') !== -1) {
        errors.push('taskVariables.key:[' + key + '] contains illegal whitespace or quotes');
      }
      if (!_.isString(value) && !_.isFinite(value)) {
        errors.push('taskVariables.key:[' + key + '] contains illegal value. Value must be a string or a number');
      }
    });
    if (errors.length) {
      throw new ValidationError(errors.join('; '));
    }
  };

  Lenr.prototype._taskVariablesToCapistrano = function(variables) {
    var result = [];
    _.each(variables, function(value, key) {
      result.push('-s ' + shellwords.escape(key) + '="' + shellwords.escape(value) + '"');
    });
    return result;
  };

  Lenr.prototype._saveJob = function(job, callback) {
    var self = this;
    this.db.saveJob(job, function(err) {
      if (err) {
        return callback(err);
      }
      self.jobQueue[job.id] = job;
      job.on('change', function() {
        self._updateJob(job);
      });
      job.on('close', function() {
        self._updateJob(job);
        delete self.jobQueue[job.id];
      });
      self.emit('create', job);
      return callback(null, job);
    });
  };

  Lenr.prototype._updateJob = function(job) {
    this.db.updateJob(job, function(err) {
      if (err) {
        getLog().error('Job update failed', {id: job.id}, err);
      }
    });
  };

  Lenr.prototype._enableGracefulShutdown = function() {
    //we can not use process.on('exit') because it forbids to use async operations.
    var self = this;
    _.each(['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'SIGABRT'], function(signal) {
      process.on(signal, function() {
        self._shutdown(signal);
      });
    });
  };

  Lenr.prototype._shutdown = function(signal) {
    this._isShuttingDown = true;
    getLog().info('The process was interrupted by ' + signal + '. Shutting down.');
    async.each(_.values(this.jobQueue), function(job, callback) {
      job.on('close', function() {
        callback();
      });
    }, function() {
      process.exit();
    });
  };

  return Lenr;

})();
