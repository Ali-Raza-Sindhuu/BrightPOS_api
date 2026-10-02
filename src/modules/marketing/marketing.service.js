const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');

function text(value, label, max, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new ApiError(400, `${label} ${required ? 'is required and ' : ''}must be text of at most ${max} characters`);
  }
  return value.trim() || null;
}

function validate(body) {
  const kind = body.kind || 'contact';
  if (!['contact', 'demo', 'trial', 'newsletter'].includes(kind)) throw new ApiError(400, 'Invalid request type');
  const email = text(body.email, 'Email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid email address');
  if (body.consent !== true) throw new ApiError(400, 'Consent is required');
  return {
    kind, email,
    name: text(body.name, 'Name', 150, kind !== 'newsletter'),
    business: text(body.businessName, 'Business name', 150),
    plan: text(body.plan, 'Plan', 50),
    message: text(body.message, 'Message', 3000),
  };
}

async function submit(body) {
  const data = validate(body);
  await pool.execute(
    `INSERT INTO marketing_submissions (kind, name, email, business_name, plan, message, newsletter_key)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE newsletter_key = newsletter_key`,
    [data.kind, data.name, data.email, data.business, data.plan, data.message, data.kind === 'newsletter' ? data.email : null],
  );
}

async function list(query) {
  const page = Number(query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new ApiError(400, 'Invalid page');
  const limit = 25;
  const [rows] = await pool.query('SELECT id, kind, name, email, business_name, plan, message, status, created_at FROM marketing_submissions ORDER BY id DESC LIMIT ? OFFSET ?', [limit, (page - 1) * limit]);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM marketing_submissions');
  return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function updateStatus(id, status) {
  if (!/^\d+$/.test(String(id)) || !['new', 'contacted', 'closed'].includes(status)) throw new ApiError(400, 'Invalid submission or status');
  const [result] = await pool.execute('UPDATE marketing_submissions SET status = ? WHERE id = ?', [status, id]);
  if (!result.affectedRows) throw new ApiError(404, 'Submission not found');
}

module.exports = { validate, submit, list, updateStatus };
