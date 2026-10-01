const ApiError = require('./api-error');

// Money is accepted as a decimal with at most two places, then compared and
// accumulated as integer minor units. mysql2 DECIMAL strings are supported.
function minor(value, label = 'amount') {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !/^-?\d+(?:\.\d{1,2})?$/.test(String(value))) {
    throw new ApiError(422, `${label} must be a finite decimal with at most two decimal places`);
  }
  const negative = String(value).startsWith('-');
  const [whole, fraction = ''] = String(value).replace(/^-/, '').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 999999999999) throw new ApiError(422, `${label} is out of range`);
  return negative ? -result : result;
}
function money(value, label = 'amount', { positive = false } = {}) {
  const cents = minor(value, label);
  if (cents < 0 || (positive && cents === 0)) throw new ApiError(422, `${label} must be ${positive ? 'positive' : 'non-negative'}`);
  return cents / 100;
}
function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ApiError(422, 'Invalid monetary calculation');
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function statusFor(paid, payable, partial = 'partially_paid') {
  if (minor(paid) >= minor(payable)) return 'paid';
  return minor(paid) > 0 ? partial : 'unpaid';
}
function lineTotal(price, qty) {
  require('./validation').quantity(qty);
  const [whole, fraction = ''] = String(qty).split('.');
  const hundredths = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const cents = (BigInt(minor(price, 'unit_price')) * hundredths + 50n) / 100n;
  if (cents < 0n || cents > 999999999999n) throw new ApiError(422, 'Line total is out of range');
  return Number(cents) / 100;
}
module.exports = { minor, money, round2, statusFor, lineTotal };
