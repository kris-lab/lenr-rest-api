var _ = require('underscore');
var getLog = require('../logger').getLog;

module.exports = (function() {

  /**
   * @param {Object} lenr
   * @constructor
   */
  function LenrREST(lenr) {
    this.lenr = lenr;
  }

  /**
   * @param {Object} server
   */
  LenrREST.prototype.installHandlers = function(server) {
    var self = this;

    server.all('*', function(req, res, next) {
      if (!self.lenr.isShuttingDown()) {
        return next();
      } else {
        return next(new LenrError('Server is shutting down', 500));
      }
    });

    server.post('/:app/:env', function createJob(req, res, next) {
      var params = _.extend({}, req.params, req.body);
      var wait = !!params.wait;
      getLog().debug('Job create', {params: params});
      self.lenr.createJob(params.app, params.env, params.task, params.taskVariables, function(err, job) {
        if (err) {
          getLog().error('Job create failed', {params: params}, err);
          return next(err);
        }
        getLog().debug('Job create success', {params: params, job: job});
        var response = {
          id: job.id,
          url: req.protocol + '://' + req.headers.host + '/web#job/' + job.id
        };
        if (wait) {
          job.on('close', function() {
            response.data = job.getClientData();
            res.send(response);
            return next();
          });
          job.execute();
        } else {
          job.execute();
          res.send(response);
          return next();
        }
      });
    });

    server.get('/job/:id', function getJobById(req, res, next) {
      getLog().debug('Job find', {id: req.params.id});
      self.lenr.getJob(req.params.id, function(err, job) {
        if (err) {
          getLog().error('Job find failed', {id: req.params.id}, err);
          return next(err);
        }
        getLog().debug('Job find success', {id: req.params.id, job: job});
        return res.send(job.getClientData());
      });
    });

    server.post('/job/:id/kill', function killJobById(req, res, next) {
      getLog().debug('Job kill', {id: req.params.id});
      self.lenr.getJob(req.params.id, function(err, job) {
        if (err) {
          getLog().error('Job kill failed', {id: req.params.id}, err);
          return next(err);
        }
        job.kill();
        return res.send(200);
      });
    });

    server.post('/job/:id/restart', function restartJobById(req, res, next) {
      getLog().debug('Job restart', {id: req.params.id});
      self.lenr.getJob(req.params.id, function(err, job) {
        if (err) {
          getLog().error('Job restart failed', {id: req.params.id}, err);
          return next(err);
        }
        self.lenr.restartJob(job, function(err) {
          if (err) {
            next(err);
          } else {
            res.send(200);
          }
        });
      });
    });

    server.get('/jobs', function getJobList(req, res, next) {
      var params = _.extend({}, req.params, req.body);
      var currentPage = params.currentPage;
      if (!_.isNumber(currentPage)) {
        currentPage = 0;
      }
      var pageSize = params.pageSize;
      if (!_.isNumber(pageSize)) {
        pageSize = 10;
      }
      self.lenr.getJobList(function(err, jobList) {
        if (err) {
          getLog().error('JobList get failed', err);
          return next(err);
        }
        jobList = _.map(jobList, function(job) {
          return job.getClientData();
        });
        return res.send(jobList);
      }, Math.round(currentPage), Math.round(pageSize));
    });

    server.get('/:app/:env/tasks', function getAvailableTasks(req, res, next) {
      self.lenr.getAvailableTasks(req.params.app, req.params.env, function(err, tasks) {
        if (err) {
          getLog().error('Available Cap tasks get failed', {params: req.params}, err);
          return next(err);
        }
        return res.send(tasks);
      });
    });

    return server;

  };

  return LenrREST;

})();
