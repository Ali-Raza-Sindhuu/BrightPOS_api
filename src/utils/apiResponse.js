const success = (res, statusCode, message, data = null, meta = null) => {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

module.exports = { success };
