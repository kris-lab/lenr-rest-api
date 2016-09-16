require('../../lib/errors');
var _ = require('underscore');
var async = require('async');
var Lenr = require('../../lib/lenr/index');
var LenrJob = require('../../lib/lenr/job');
var LenrDb = require('../../lib/lenr/db');
var assert = require('chai').assert;
var jobArgs = require('../data/jobArgs');
var Config = require('../../lib/config');

/**
 * This test suite must be the last to execute as it performs process.exit.
 */
describe('tests of lenr API', function() {

  this.timeout(2000);

  var testConfig = new Config('./test/data/configs/config.yaml').asHash();
  require('../../lib/logger').configure(testConfig);

  beforeEach(function(done) {
    var self = this;

    new LenrDb(testConfig.mongodb, function(err, db) {
      if (err) {
        done(err);
        return;
      }
      self.lenrDb = db;
      //remove all items from collection that might remain from previous tests.
      db.collection.remove(function(err) {
        self.lenr = new Lenr(db, testConfig.lenr);
        process.setMaxListeners(15);
        done(err);
      });
    });
  });

  after(function(done) {
    this.lenrDb.collection.remove(done);
  });

  it('check if taskVariables are validated', function() {
    var app = jobArgs.app.example;
    var env = jobArgs.env.production;
    var task = jobArgs.task.dummySleepy;

    function callback(err, job) {
    }

    var self = this;
    assert.throw(function() {
      self.lenr.createJob(app, env, task, [], callback);
    }, ValidationError);
    assert.throw(function() {
      self.lenr.createJob(app, env, task, {key: []}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.lenr.createJob(app, env, task, {key: {}}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.lenr.createJob(app, env, task, {'key df': ''}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.lenr.createJob(app, env, task, {'ke"ydf': ''}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.lenr.createJob(app, env, task, {'keydf\'': ''}, callback);
    }, ValidationError);

    _.each(Lenr.ILLEGAL_TASKS, function(task) {
      assert.throw(function() {
        self.lenr.createJob(app, env, task, {'key': ''}, callback);
      }, ValidationError);
    });

  });

  it('check if job is created', function(done) {
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err && job.status == LenrJob.STATUS.CREATED);
        done();
      });
  });

  it('tests a normal job\'s lifecycle', function(done) {
    this.timeout(12000);
    var self = this;
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err && job.status == LenrJob.STATUS.CREATED);
        var hadRun = false;
        job.on('change', function() {
          hadRun = job.status == LenrJob.STATUS.RUNNING;
        });
        job.on('close', function() {
          assert(hadRun);
          self.lenr.getJob(job.id, function(err, job) {
            assert(!err && job.status == LenrJob.STATUS.FINISHED);
            done();
          });
        });
        job.execute();
      });
  });

  it('check if job can be got after it is created', function(done) {
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err);
        this.lenr.getJob(job.id, function(err, result) {
          assert.deepEqual(result.getData(), job.getData());
          done();
        });
      }.bind(this));
  });

  it('check if created job in the list of current jobs of lenr', function(done) {
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err);
        this.lenr.getJobList(function(err, jobList) {
          assert(jobList.length === 1);
          assert.deepEqual(job.getData(), jobList[0].getData());
          assert.deepEqual(job.getArgs(), jobList[0].getArgs());
          done();
        });
      }.bind(this));
  });

  it('check if created job returns available tasks', function(done) {
    this.lenr.getAvailableTasks(jobArgs.app.example, jobArgs.env.production, function(err, tasks) {
      assert(!err);
      assert(tasks['shell'], 'Shell task must be always present in available tasks');
      _.each(jobArgs.task, function(taskName) {
        assert(taskName in tasks, 'Test tasks must be present in available tasks');
      });
      done();
    });
  });

  it('check if created job can be killed with SIG TERM signal', function(done) {
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err);
        job.execute();
        job.once('change', function() {
          job.kill();
        });
        job.on('close', function() {
          assert(job.status == LenrJob.STATUS.KILLED, 'The job kill (SIGTERM) does not work');
          done();
        });
      });
  });

  it('check if created job can be killed with SIG KILL signal', function(done) {
    //only for the sake of the test
    LenrJob._KILL_TIMEOUT = 200;
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummyUnKillable,
      function(err, job) {
        assert(!err);
        job.execute();
        job.once('change', function() {
          setTimeout(function() {
            assert(job.status == LenrJob.STATUS.KILLING, 'Job status must be ' + LenrJob.STATUS.KILLING);
          }, LenrJob._KILL_TIMEOUT - 1);

          setTimeout(function() {
            assert(job.status == LenrJob.STATUS.KILLED, 'The job kill (SIGKILL) does not work');
            done();
          }, LenrJob._KILL_TIMEOUT + 50);

          job.kill();
        });
      });
  });

  it('check if created job can be restarted after it\'s killed', function(done) {
    this.timeout(12000);
    //only for the sake of the test
    LenrJob._KILL_TIMEOUT = 200;
    var self = this;
    this.lenr.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        job.execute();
        job.once('close', function() {
          self.lenr.restartJob(job, function(err, job) {
            assert(!err && LenrJob.STATUS.RUNNING == job.status);
            job.once('close', function() {
              assert(LenrJob.STATUS.FINISHED == job.status);
              done();
            });
          });
        });
        job.kill();
      });
  });

  it('check if the current jobs are shutdowned when the api process is killed', function(done) {
    this.timeout(12000);
    var self = this;
    async.map([null, null], function(dummy, callback) {
      self.lenr.createJob(
        jobArgs.app.example,
        jobArgs.env.production,
        jobArgs.task.dummySleepy,
        function(err, job) {
          assert(!err);
          job.execute();
          job.once('change', function() {
            assert(job.status == LenrJob.STATUS.RUNNING, 'Job should be running');
            callback(null, job);
          });
        });
    }, function(err, jobs) {
      assert(jobs && jobs.length === 2);
      process.on('exit', function() {
        _.each(jobs, function(job) {
          assert(job.status == LenrJob.STATUS.FINISHED, 'Job should be finished');
        });
        //because `_shutdown` kills the process, we need to clean after the test manually.
        self.lenrDb.collection.remove(done);
      });
      self.lenr._shutdown('SIGINT');
    });
  });

});
