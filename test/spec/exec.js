require('../../lib/errors');
var LenrExec = require('../../lib/lenr/exec');
var assert = require('chai').assert;
var jobArgs = require('../data/jobArgs');

describe('Test constructor arguments of LenrExec', function() {

  it('throw error if arguments are wrong', function() {
    assert.throw(function() {
      new LenrExec()
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({app: ''})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({app: ' '})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({env: ''})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({env: ' '})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({app: jobArgs.app.example})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({env: jobArgs.env.production})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({app: ' ', env: ' '})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({app: jobArgs.app.example, env: jobArgs.env.production, lenrOptions: ['no-dash']})
    }, ValidationError);
    assert.throw(function() {
      new LenrExec({app: jobArgs.app.example, env: jobArgs.env.production, lenrOptions: ['-c some-repo', '-b some-branch', 'no-dash']})
    }, ValidationError);
  });

  it('create arguments that will run spawn correctly', function() {
    var exec;

    exec = new LenrExec({app: jobArgs.app.example, env: jobArgs.env.production, capistranoOptions: ['  -s hello', '-s "bye bye"']});
    assert.deepEqual(exec.getCommandArgs(), [jobArgs.app.example, jobArgs.env.production, '-s', 'hello', '-s', 'bye bye']);

    exec = new LenrExec({app: jobArgs.app.example, env: jobArgs.env.production, lenrOptions: ['--b ', '  --b "hi hi"  ']});
    assert.deepEqual(exec.getCommandArgs(), ['--b', '--b', 'hi hi', jobArgs.app.example, jobArgs.env.production]);

    exec = new LenrExec({app: jobArgs.app.example, env: jobArgs.env.production, capistranoOptions: ['m bueno', 'none', 'm vista']});
    assert.deepEqual(exec.getCommandArgs(), [jobArgs.app.example, jobArgs.env.production, 'm', 'bueno', 'none', 'm', 'vista']);
  });

});
