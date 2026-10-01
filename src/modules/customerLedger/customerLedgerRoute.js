// customerLedgerController.js
const pool = require('../../config/db');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const express = require('express');

async function getCustomerLedgerData(customerId) {
  const [[customer]] = await pool.query(
    'SELECT id, customer_name, previous_balance FROM customers WHERE id = ?',
    [customerId]
  );
  if (!customer) throw new Error('Customer not found'); // wrap with ApiError(404, ...) if available here

  const [invoices] = await pool.query(
    `SELECT id, created_at AS date, receipt_no, payable AS amount
     FROM sale_invoices WHERE customer_id = ?`,
    [customerId]
  );

  const [returns] = await pool.query(
    `SELECT id, return_date AS date, total_amount AS amount
     FROM sale_returns WHERE customer_id = ?`,
    [customerId]
  );

  const [bookings] = await pool.query(
    `SELECT id, created_at AS date, payable AS amount
     FROM bookings WHERE customer_id = ?`,
    [customerId]
  );

  const [salesPayments] = await pool.query(
    `SELECT id, invoice_id, payment_date AS date, amount, remarks
     FROM customer_payments WHERE customer_id = ?`,
    [customerId]
  );

  const [bookingPayments] = await pool.query(
    `SELECT bp.id, bp.booking_id, bp.payment_date AS date, bp.amount, bp.remarks
     FROM booking_payments bp
     INNER JOIN bookings b ON b.id = bp.booking_id
     WHERE b.customer_id = ?`,
    [customerId]
  );

  const openingEntry = {
    date: null,
    reference: 'OB',
    module: 'Opening Balance',
    description: 'Opening Balance',
    debit: Number(customer.previous_balance) > 0 ? Number(customer.previous_balance) : 0,
    credit: Number(customer.previous_balance) < 0 ? Math.abs(Number(customer.previous_balance)) : 0,
  };

  const debitEntries = [
  ...invoices.map((r) => ({
    id: r.id,
    date: r.date,
    reference: r.receipt_no ? `RCP-${r.receipt_no}` : `INV-${r.id}`,
    module: 'Sales',
    description: 'Sales Invoice',
    debit: Number(r.amount) || 0,
    credit: 0,
  })),
  ...bookings.map((r) => ({
    id: r.id,
    date: r.date,
    reference: `BKG-${r.id}`,
    module: 'Booking',
    description: 'Booking Charge',
    debit: Number(r.amount) || 0,
    credit: 0,
  })),
];

const creditEntries = [
  ...returns.map((r) => ({
    id: r.id,
    date: r.date,
    reference: `RTN-${r.id}`,
    module: 'Sales Return',
    description: 'Sales Return',
    debit: 0,
    credit: Number(r.amount) || 0,
  })),
  ...salesPayments.map((r) => ({
    id: r.id,
    date: r.date,
    reference: r.invoice_id ? `PAY-INV-${r.invoice_id}` : `PAY-${r.id}`,
    module: 'Payment',
    description: r.remarks || 'Payment Received',
    debit: 0,
    credit: Number(r.amount) || 0,
  })),
  ...bookingPayments.map((r) => ({
    id: r.id,
    date: r.date,
    reference: `PAY-BKG-${r.booking_id}`,
    module: 'Booking Payment',
    description: r.remarks || 'Booking Payment Received',
    debit: 0,
    credit: Number(r.amount) || 0,
  })),
];

  const transactionEntries = [...debitEntries, ...creditEntries].sort((a, b) => {
  const dateDiff = new Date(a.date) - new Date(b.date);
  if (dateDiff !== 0) return dateDiff;
  return (a.id || 0) - (b.id || 0); // tiebreaker for same-day entries
});

  const allEntries = [openingEntry, ...transactionEntries];

  let balance = 0;
  const ledger = allEntries.map((entry) => {
    balance += entry.debit - entry.credit;
    return { ...entry, balance };
  });

  return { ledger, closingBalance: balance, customerName: customer.customer_name };
}

const controller = {
  getCustomerLedger: catchAsync(async (req, res) => {
    const result = await getCustomerLedgerData(req.params.id);
    sendResponse(res, 200, 'Customer ledger fetched successfully', result);
  }),
};

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('CUSTOMER_ACCOUNT'));
router.get('/:id', controller.getCustomerLedger);

module.exports = router;