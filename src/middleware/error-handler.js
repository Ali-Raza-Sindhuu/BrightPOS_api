const ApiError = require("../utils/api-error");

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const databaseStatus = { ER_DUP_ENTRY: 409, ER_ROW_IS_REFERENCED_2: 409, ER_NO_REFERENCED_ROW_2: 422, ER_CHECK_CONSTRAINT_VIOLATED: 409, ER_LOCK_DEADLOCK: 409, ER_LOCK_WAIT_TIMEOUT: 503 }[err.code];
  const statusCode = err instanceof ApiError ? err.statusCode : databaseStatus || (err.type === 'entity.parse.failed' ? 400 : err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = databaseStatus ? ({ 409: 'Operation conflicts with existing records or a concurrent transaction', 422: 'Referenced record does not exist', 503: 'Database busy; try again' }[databaseStatus]) : statusCode === 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;

  if (statusCode === 500) {
    console.error(err);
  }
  if (statusCode === 429) res.set('Retry-After', '900');

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { notFound, errorHandler };
