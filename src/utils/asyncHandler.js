// Wraps an async Express handler so rejected promises are forwarded to next(err)
// instead of crashing the process or requiring try/catch in every controller.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
