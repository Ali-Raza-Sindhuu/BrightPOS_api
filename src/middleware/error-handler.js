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
    // Driver errors can contain SQL values, password hashes and personal data.
    console.error(JSON.stringify({event:'request.error',request_id:req.id,code:err.code || err.apiCode || 'INTERNAL_ERROR',name:err.name}));
  }
  if (statusCode === 429) res.set('Retry-After', '900');

  res.status(statusCode).json({
    success: false,
    message,
    code: err.apiCode || ({400:'INVALID_REQUEST',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',422:'VALIDATION_FAILED',429:'RATE_LIMITED',503:'UNAVAILABLE'}[statusCode] || 'INTERNAL_ERROR'),
    ...(err instanceof ApiError && err.details ? {details:err.details} : {}),
    ...(req.id ? {request_id:req.id} : {}),
  });
}

module.exports = { notFound, errorHandler };
