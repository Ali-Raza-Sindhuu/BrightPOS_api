// Parses page/limit query params into safe LIMIT/OFFSET values
const getPagination = (query) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// Accept both established call forms while callers are normalized.
const buildMeta = (pageOrOptions, limitArg, totalArg) => {
  const { page, limit, total } = typeof pageOrOptions === "object"
    ? pageOrOptions
    : { page: pageOrOptions, limit: limitArg, total: totalArg };

  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
};

module.exports = { getPagination, buildMeta };
