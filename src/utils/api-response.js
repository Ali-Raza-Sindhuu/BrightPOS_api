const success = (res, statusCode, message, data = null, meta = null) => {
  return require('./send-response')(res, statusCode, message, data, meta ?? undefined);
};

module.exports = { success };
