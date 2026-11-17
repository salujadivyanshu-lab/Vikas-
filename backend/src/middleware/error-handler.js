function notFoundHandler(_req, _res, next) {
  const error = new Error('Route not found.');
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (statusCode >= 500) console.error('Unhandled API error:', error);
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error.' : error.message,
  });
}

module.exports = { notFoundHandler, errorHandler };