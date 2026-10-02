const ApiError = require('./api-error');
const MAX = 999999999999n;
function scaled(value, places = 2, label = 'quantity', allowNegative = false) {
  if (!['string', 'number'].includes(typeof value) || !new RegExp(`^${allowNegative ? '-?' : ''}\\d+(?:\\.\\d{1,${places}})?$`).test(String(value))) throw new ApiError(422, `${label} requires at most ${places} decimal places`);
  const negative = String(value).startsWith('-');
  const [whole, fraction = ''] = String(value).replace(/^-/, '').split('.');
  const result = BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
  if (result > (places <= 2 ? 999999999999999n : 999999999999999999n)) throw new ApiError(422, `${label} is out of range`);
  return negative ? -result : result;
}
function decimal(value, places = 2) {
  value = BigInt(value); const sign = value < 0n ? '-' : ''; value = value < 0n ? -value : value;
  const unit = 10n ** BigInt(places);
  return `${sign}${value / unit}.${String(value % unit).padStart(places, '0')}`;
}
function integer(value, label = 'amount_minor', positive = false) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))) throw new ApiError(422, `${label} must be integer minor units`);
  const n = BigInt(value);
  if (n > MAX || (positive && !n)) throw new ApiError(422, `${label} is out of range`);
  return Number(n);
}
function multiply(priceMinor, quantity) { return checked((BigInt(priceMinor) * scaled(quantity) + 50n) / 100n); }
function checked(value) { value = BigInt(value); if (value < 0n || value > MAX) throw new ApiError(422, 'Calculated amount is out of range'); return Number(value); }
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (!sum) return weights.map(() => 0);
  let cumulative = 0n, previous = 0n;
  return weights.map(weight => { cumulative += BigInt(weight); const next = BigInt(total) * cumulative / sum; const result = Number(next - previous); previous = next; return result; });
}
module.exports = { scaled, decimal, integer, multiply, checked, allocate };
