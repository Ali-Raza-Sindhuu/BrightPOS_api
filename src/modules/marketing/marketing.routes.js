const router = require('express').Router();
const asyncHandler = require('../../utils/async-handler');
const authenticate = require('../../middleware/authentication');
const requirePermission = require('../../middleware/require-permission');
const service = require('./marketing.service');
const ApiError = require('../../utils/api-error');

// Bounded per-process abuse guard; no visitor IPs are stored in the database.
const attempts = new Map();
router.post('/submissions', (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const entry = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 10 || (!attempts.has(req.ip) && attempts.size >= 10000)) {
    return next(new ApiError(429, 'Too many submissions. Try again in 15 minutes.'));
  }
  entry.count += 1;
  attempts.set(req.ip, entry);
  next();
}, asyncHandler(async (req, res) => {
  await service.submit(req.body);
  res.status(201).json({ success: true, message: req.body.kind === 'newsletter' ? 'Subscription saved.' : 'Request received. We will contact you by email.' });
}));

router.get('/submissions', authenticate, requirePermission('ACCESS.USER_GROUPS.READ'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query) });
}));
router.patch('/submissions/:id', authenticate, requirePermission('ACCESS.USER_GROUPS.UPDATE'), asyncHandler(async (req, res) => {
  await service.updateStatus(req.params.id, req.body.status);
  res.json({ success: true, message: 'Status updated.' });
}));

module.exports = router;
