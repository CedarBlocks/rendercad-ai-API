/**
 * Base error class for RenderCAD API errors
 */
class RenderCADError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'RenderCADError';
    this.statusCode = statusCode;
    this.response = response;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for invalid requests (400)
 */
class BadRequestError extends RenderCADError {
  constructor(message, response) {
    super(message || 'Invalid request', 400, response);
    this.name = 'BadRequestError';
  }
}

/**
 * Error for authentication failures (401)
 */
class UnauthorizedError extends RenderCADError {
  constructor(message, response) {
    super(message || 'Invalid API token', 401, response);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error for resource not found (404)
 */
class NotFoundError extends RenderCADError {
  constructor(message, response) {
    super(message || 'Resource not found', 404, response);
    this.name = 'NotFoundError';
  }
}

/**
 * Error for rate limit exceeded (429)
 */
class RateLimitError extends RenderCADError {
  constructor(message, response) {
    super(message || 'Monthly limit exceeded', 429, response);
    this.name = 'RateLimitError';
  }
}

/**
 * Error for server errors (500)
 */
class ServerError extends RenderCADError {
  constructor(message, response) {
    super(message || 'Server error', 500, response);
    this.name = 'ServerError';
  }
}

module.exports = {
  RenderCADError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
  ServerError,
};

