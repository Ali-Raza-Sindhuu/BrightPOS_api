/**
 * Consistent response shape across every module: { success, message, data, meta? }
 */
module.exports = function sendResponse(res, statusCode, message, data = null, meta = undefined) {
  const payload = { success: true, message, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
};
