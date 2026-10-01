const ApiError = require('./api-error');
function id(value, label = 'id') {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 4294967295) throw new ApiError(422, `${label} must be a positive integer`);
  return Number(value);
}
function quantity(value, label = 'quantity', allowZero = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(?:\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value) > 9999999999999.99 || (allowZero ? Number(value) < 0 : Number(value) <= 0)) throw new ApiError(422, `${label} must be ${allowZero ? 'non-negative' : 'positive'} with at most two decimal places`);
  return Number(value);
}
function date(value, label = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000 || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new ApiError(422, `${label} must be a valid YYYY-MM-DD date`);
  return value;
}
function rejectFields(body, fields) {
  const present = fields.filter(field => body[field] !== undefined);
  if (present.length) throw new ApiError(422, `Server-managed or immutable fields: ${present.join(', ')}`);
}
function filters(query) {
  const result = { ...query };
  for (const key of ['customer_id', 'supplier_id', 'item_id', 'category_id', 'business_unit_id', 'invoice_id', 'purchase_id']) if (result[key] !== undefined && result[key] !== '') result[key] = id(result[key], key);
  for (const key of ['from_date', 'to_date']) if (result[key]) date(result[key], key);
  if (result.from_date && result.to_date && result.from_date > result.to_date) throw new ApiError(422, 'from_date must not exceed to_date');
  return result;
}
module.exports = { id, quantity, date, rejectFields, filters };
