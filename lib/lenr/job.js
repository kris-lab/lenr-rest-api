var LenrExec = require('./exec');
var events = require('events');
var util = require('util');
var psTree = require('ps-tree');
var _ = require('underscore');
var getLog = require('../logger').getLog;

module.exports = (function() {

  /**
   * @param {Object|null} execArgs {@see LenrExec}
   * @param {Object} [jobData] already available data for the job.
   * @constructor
   */
  var LenrJob = function(execArgs, jobData) {
    if (execArgs) {
      LenrExec.call(this, execArgs);
    }
    events.EventEmitter.call(this);

    if (jobData) {
      this.setData(jobData);
    } else {
      this.createInitialData();
    }
    this._jobProcess = null;
  };

  LenrJob.STATUS = {
    CREATED: 'CREATED', RUNNING: 'RUNNING', FINISHED: 'FINISHED', FAILED: 'FAILED', KILLED: 'KILLED', KILLING: 'KILLING'
  };

  util.inherits(LenrJob, events.EventEmitter);
  _.extend(LenrJob.prototype, LenrExec.prototype);

  LenrJob.prototype.onUpdate = function() {
    this.emit("change", {job: this});
  };

  LenrJob.prototype.onClose = function() {
    this.emit("close", {job: this});
  };

  LenrJob.prototype.execute = function() {
    getLog().debug('Job execute', {id: this.id});
    this._jobProcess = this.run();
    this.status = LenrJob.STATUS.RUNNING;
    this.pid = this._jobProcess.pid;
    this.command = this.getCapistranoCommandArgs().join(' ');
    var self = this;
    this._jobProcess.stdout.on('data', function(data) {
      self.stdout += data;
      self.output += data;
      self.onUpdate();
    });

    this._jobProcess.stderr.on('data', function(data) {
      self.output += data;
      self.onUpdate();
    });

    this._jobProcess.on('close', function(code, signal) {
      self.exitCode = code;
      if (signal || code > 128) {
        self.status = LenrJob.STATUS.KILLED;
      } else {
        if (code == 0) {
          self.status = LenrJob.STATUS.FINISHED;
        } else {
          self.status = LenrJob.STATUS.FAILED;
        }
      }
      getLog().debug('Job execute finished', {id: self.id, status: self.status});
      self.onClose();
    });
  };

  LenrJob._KILL_TIMEOUT = 2000;

  /**
   * @param {Function} callback fn(Number pid)
   */
  LenrJob.prototype._forEachJobPid = function(callback) {
    if (this._jobProcess) {
      psTree(this._jobProcess.pid, function(err, children) {
        var pids = children.map(function(p) {
          return p.PID;
        });
        pids.push(this._jobProcess.pid);
        pids.forEach(function(pid) {
          callback(pid);
        });
      }.bind(this));
    }
  };

  LenrJob.prototype.kill = function() {
    if (this.status == LenrJob.STATUS.RUNNING) {
      this.status = LenrJob.STATUS.KILLING;
      getLog().debug('Job kill', {id: this.id});
      this._forEachJobPid(function(pid) {
        try {
          process.kill(pid, 'SIGTERM');
          setTimeout(this._killTimeout.bind(this, pid), LenrJob._KILL_TIMEOUT);
        } catch (e) {
          this._onKillError(e);
        }
      }.bind(this));
    }
  };

  LenrJob.prototype._killTimeout = function(pid) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (e) {
      this._onKillError(e);
    }
  };

  /**
   * @param {Error} err Error that as thrown when we've tried to kill process.
   * @private
   */
  LenrJob.prototype._onKillError = function(err) {
    if (err.code !== 'ESRCH') {
      this.status = LenrJob.STATUS.FAILED;
      getLog().error('Job kill failed', {id: this.id}, err);
    }
  };

  LenrJob.prototype.getData = function() {
    return {
      id: this.id,
      status: this.status,
      timestamp: this.timestamp,
      exitCode: this.exitCode,
      stdout: this.stdout,
      output: this.output,
      pid: this.pid,
      args: this._args
    };
  };

  LenrJob.prototype.getClientData = function() {
    return {
      id: this.id,
      status: this.status,
      timestamp: this.timestamp,
      stdout: this.stdout,
      output: this.output,
      command: this.getCapistranoCommandArgs().join(' '),
      args: this._args
    };
  };

  LenrJob.prototype.setData = function(data) {
    this.id = data.id;
    this.status = data.status;
    this.timestamp = data.timestamp;
    this.exitCode = data.exitCode;
    this.stdout = data.stdout;
    this.output = data.output;
    this.pid = data.pid;
    this._args = data.args;
  };

  LenrJob.prototype.createInitialData = function() {
    this.status = LenrJob.STATUS.CREATED;
    this.timestamp = new Date().getTime();
    this.stdout = '';
    this.output = '';
    this.exitCode = null;
    this.pid = null;
  };

  return LenrJob;

})();
