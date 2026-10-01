// daybookController.js — new, computed version
const pool = require('../../config/db');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const express = require('express');

async function getDaybook(from, to) {
  const params = [from, to];

  const [sales] = await pool.query(
    `SELECT id, created_at AS date, receipt_no AS reference, payable AS cash_in, 0 AS cash_out,
            'Sale' AS module, CONCAT('Sale Invoice - ', COALESCE(receipt_no, id)) AS description
     FROM sale_invoices WHERE DATE(created_at) BETWEEN ? AND ?`,
    params
  );

  const [purchases] = await pool.query(
    `SELECT id, created_at AS date, invoice_no AS reference, 0 AS cash_in, payable AS cash_out,
            'Purchase' AS module, CONCAT('Purchase Invoice - ', COALESCE(invoice_no, id)) AS description
     FROM purchases WHERE DATE(created_at) BETWEEN ? AND ?`,
    params
  );

  const [customerPayments] = await pool.query(
    `SELECT id, payment_date AS date, id AS reference, amount AS cash_in, 0 AS cash_out,
            'Customer Payment' AS module, CONCAT('Payment Received - ', payment_method) AS description
     FROM customer_payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
    params
  );

  const [supplierPayments] = await pool.query(
    `SELECT id, payment_date AS date, id AS reference, 0 AS cash_in, amount AS cash_out,
            'Supplier Payment' AS module, CONCAT('Payment Made - ', payment_method) AS description
     FROM supplier_payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
    params
  );

  const [saleReturns] = await pool.query(
    `SELECT id, return_date AS date, id AS reference, 0 AS cash_in, total_amount AS cash_out,
            'Sales Return' AS module, CONCAT('Sales Return - RTN-', id) AS description
     FROM sale_returns WHERE DATE(return_date) BETWEEN ? AND ?`,
    params
  );

  const [purchaseReturns] = await pool.query(
    `SELECT id, return_date AS date, id AS reference, total_amount AS cash_in, 0 AS cash_out,
            'Purchase Return' AS module, CONCAT('Purchase Return - RTN-', id) AS description
     FROM purchase_returns WHERE DATE(return_date) BETWEEN ? AND ?`,
    params
  );

  const [bookingPayments] = await pool.query(
    `SELECT id, payment_date AS date, id AS reference, amount AS cash_in, 0 AS cash_out,
            'Booking Payment' AS module, CONCAT('Booking Payment - BKG-', booking_id) AS description
     FROM booking_payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
    params
  );

  const allEntries = [
    ...sales, ...purchases, ...customerPayments, ...supplierPayments,
    ...saleReturns, ...purchaseReturns, ...bookingPayments,
  ]
    .map((e) => ({ ...e, cash_in: Number(e.cash_in) || 0, cash_out: Number(e.cash_out) || 0 }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let balance = 0;
  const daybook = allEntries.map((entry) => {
    balance += entry.cash_in - entry.cash_out;
    return { ...entry, balance };
  });

  const totalCashIn = allEntries.reduce((s, e) => s + e.cash_in, 0);
  const totalCashOut = allEntries.reduce((s, e) => s + e.cash_out, 0);

  return { entries: daybook, totalCashIn, totalCashOut, netBalance: balance };
}

const controller = {
  getDaybook: catchAsync(async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) throw new (require('../../utils/ApiError'))(422, 'from and to date params are required');
    const result = await getDaybook(from, to);
    sendResponse(res, 200, 'Daybook fetched successfully', result);
  }),
};

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('DAY_BOOK'));
router.get('/', controller.getDaybook);
module.exports = router;