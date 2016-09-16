var MongoClient = require('mongodb');
var LenrJob = require('./job');
var _ = require('underscore');

module.exports = (function() {

  var LenrDB = function(config, callback) {
    this.connect(config.host, config.port, config.db, 'jobs', callback);
  };

  LenrDB.prototype.getUniqueJobID = function() {
    return MongoClient.ObjectID().toString();
  };

  /**
   * @callback LenrDB~saveJobCallback
   * @param {Error} error
   */
  /**
   * @param {LenrJob} job
   * @param {LenrDB~saveJobCallback} callback
   */
  LenrDB.prototype.saveJob = function(job, callback) {
    job.id = this.getUniqueJobID();
    this.collection.insert({_id: job.id, data: job.getData()}, {safe: true}, function(err) {
      return callback(err);
    });
  };

  /**
   * @param {LenrJob} job
   * @param {LenrDB~saveJobCallback} callback
   */
  LenrDB.prototype.updateJob = function(job, callback) {
    this.collection.update({_id: job.id}, {$set: {data: job.getData()}}, {safe: true}, function(err) {
      return callback(err);
    });
  };

  /**
   * @callback LenrDB~getJobCallback
   * @param {Error} error
   * @param {LenrJob} job
   */
  /**
   * @param {String} jobId
   * @param {LenrDB~getJobCallback} callback
   */
  LenrDB.prototype.getJob = function(jobId, callback) {
    this.collection.findOne({_id: jobId}, function(err, result) {
      if (err) {
        return callback(err);
      }
      if (!result) {
        return callback(new ValidationError('Invalid job'));
      }
      var job = new LenrJob(null, result.data);
      return callback(null, job);
    });
  };

  /**
   * @callback LenrDB~getJobListCallback
   * @param {Error} error
   * @param {LenrJob[]} jobs
   */
  /**
   * @param {LenrDB~getJobListCallback} callback
   * @param {Number} [currentPage]
   * @param {Number} [pageSize]
   */
  LenrDB.prototype.getJobList = function(callback, currentPage, pageSize) {
    this.collection
      .find({}, {"sort": [['data.timestamp', 'desc']]})
      .skip(currentPage * pageSize)
      .limit(pageSize)
      .toArray(function(err, resultList) {
        if (!err) {
          resultList = _.map(resultList, function(result) {
            return new LenrJob(null, result.data);
          });
        }
        return callback(err, resultList);
      });
  };

  LenrDB.prototype.connect = function(host, port, db, collection, callback) {
    var url = 'mongodb://' + host + ':' + port + '/' + db;

    this.client = MongoClient.connect(url, function(err, db) {
      if (err) {
        return callback(err);
      }
      this.db = db;
      this.collection = db.collection(collection);
      return callback(null, this);
    }.bind(this));
  };

  return LenrDB;

})();
