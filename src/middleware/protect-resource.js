const authenticate = require('./authentication');
const { requirePermission } = require('../modules/access-control/require-permission');
const ApiError = require('../utils/api-error');

const ACTION_BY_METHOD = { GET: 'READ', HEAD: 'READ', POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };

// Apply the existing group permission model to every route in a resource router.
module.exports = function protectResource(resource, overrides = {}) {
  return [authenticate, (req, res, next) => {
    try { require('../utils/validation').filters(req.query); next(); } catch (error) { next(error); }
  }, (req, res, next) => {
    const action = overrides[req.method] || ACTION_BY_METHOD[req.method];
    if (!action) return next(new ApiError(405, 'Method not allowed'));
    return requirePermission('ACCESS.' + resource + '.' + action)(req, res, next);
  }];
};
