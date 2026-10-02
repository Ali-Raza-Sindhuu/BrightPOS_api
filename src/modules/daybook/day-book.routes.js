const express = require('express');
const pool = require('../../config/db');
const asyncHandler = require('../../utils/async-handler');
const sendResponse = require('../../utils/send-response');
const { date } = require('../../utils/validation');
const ApiError = require('../../utils/api-error');

// Daybook is actual cash, not invoice charges or return credit notes. Advances
// allocated to an invoice appear through customer_payments exactly once.
async function getDaybook(from, to) {
  date(from, 'from'); date(to, 'to');
  if (from > to) throw new ApiError(422, 'from must not exceed to');
  const [rows] = await pool.query(`SELECT * FROM (
    SELECT id, payment_date AS date, CONCAT('CP-',id) AS reference, amount AS cash_in, 0 AS cash_out, 'Customer Payment' AS module, COALESCE(remarks,'Cash received') AS description FROM customer_payments WHERE LOWER(payment_method) = 'cash'
    UNION ALL
    SELECT p.id,n.created_at,CONCAT('RF-',p.id),0,p.amount_minor/100,'Refund Payment',n.reason FROM refund_payments p JOIN refund_notes n ON n.id=p.refund_id WHERE p.method='cash' AND p.status='completed'
    UNION ALL
    SELECT id,created_at,CONCAT('CM-',id),IF(direction='in',amount_minor/100,0),IF(direction='out',amount_minor/100,0),'Register Cash Movement',reason FROM cash_movements WHERE kind IN ('paid_in','paid_out','safe_drop')
    UNION ALL
    SELECT id, payment_date, CONCAT('SP-',id), 0, amount, 'Supplier Payment', COALESCE(note,'Cash paid') FROM supplier_payments WHERE LOWER(payment_method) = 'cash'
    UNION ALL
    SELECT bp.id, bp.payment_date, CONCAT('BP-',bp.id), bp.amount, 0, 'Booking Payment', COALESCE(bp.remarks,'Booking advance') FROM booking_payments bp WHERE LOWER(bp.payment_method) = 'cash' AND NOT EXISTS (SELECT 1 FROM booking_invoice_links WHERE booking_id = bp.booking_id)
    UNION ALL
    SELECT id, voucher_date, voucher_number, 0, amount, 'Expense', COALESCE(details,'Cash expense') FROM expense_vouchers WHERE status = 'posted' AND payment_method = 'cash'
    UNION ALL
    SELECT id, TIMESTAMP(date,time), CONCAT('DB-',id), cash_in, cash_out, 'Cash Entry', description FROM daybook WHERE payment_method = 'cash' AND (reference_type IS NULL OR reference_type <> 'expense')
  ) entries WHERE date < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY date, reference`, [to]);
  let balance = 0, openingBalance = 0;
  const entries = [];
  for (const row of rows) {
    const incoming = Number(row.cash_in), outgoing = Number(row.cash_out);
    balance = Math.round((balance + incoming - outgoing) * 100) / 100;
    if (String(row.date).slice(0, 10) < from) openingBalance = balance;
    else entries.push({ ...row, cash_in: incoming, cash_out: outgoing, balance });
  }
  const totalCashIn = Math.round(entries.reduce((sum, row) => sum + row.cash_in, 0) * 100) / 100;
  const totalCashOut = Math.round(entries.reduce((sum, row) => sum + row.cash_out, 0) * 100) / 100;
  return { entries, openingBalance, totalCashIn, totalCashOut, netBalance: balance };
}
const router = express.Router();

router.use(...require('../../middleware/protect-resource')('DAY_BOOK'));
router.get('/', asyncHandler(async (req, res) => {
  if (!req.query.from || !req.query.to) throw new ApiError(422, 'from and to date params are required');
  sendResponse(res, 200, 'Daybook fetched successfully', await getDaybook(req.query.from, req.query.to));
}));
router.post('/', asyncHandler(async (req, res) => {
  const entry = await require('./day-book.service').create({ ...req.body, created_by: req.user.id });
  sendResponse(res, 201, 'Cash entry recorded successfully', entry);
}));
module.exports = router;
module.exports.getDaybook = getDaybook;
