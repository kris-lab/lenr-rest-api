var util = require('util');

function LenrError(message, code) {
  Error.apply(this, arguments);
  Error.captureStackTrace(this, arguments.callee);
  this.message = message;
  this.code = code;
}
util.inherits(LenrError, Error);
global.LenrError = LenrError;

function ValidationError(message) {
  LenrError.call(this, message, 400);
}
util.inherits(ValidationError, LenrError);
global.ValidationError = ValidationError;

function AuthenticationError(message) {
  LenrError.call(this, message, 401);
}
util.inherits(AuthenticationError, LenrError);
global.AuthenticationError = AuthenticationError;

function AuthorizationError(message) {
  LenrError.call(this, message, 403);
}
util.inherits(AuthorizationError, LenrError);
global.AuthorizationError = AuthorizationError;
