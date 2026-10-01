const express = require('express');
const pool = require('../../config/db');
const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');

// Every query in this file hard-codes status = 'posted'. This is
// deliberate and non-negotiable per the spec ("only POSTED vouchers
// should affect reports") -- status is NOT exposed as a report filter,
// because a report is exactly the place where a draft or cancelled
// voucher must never be able to leak in, even by user error.
//
// Nothing here stores a total anywhere; every number is SUM()'d from
// expense_vouchers at request time, so the report can never drift out
// of sync with the vouchers it's built from.

function buildFilters(query) {
  const clauses = ["ev.status = 'posted'"];
  const params = [];
  if (query.business_unit_id) {
    clauses.push('ev.business_unit_id = ?');
    params.push(query.business_unit_id);
  }
  if (query.head_id) {
    clauses.push('ev.head_id = ?');
    params.push(query.head_id);
  }
  if (query.payment_method) {
    clauses.push('ev.payment_method = ?');
    params.push(query.payment_method);
  }
  if (query.from) {
    clauses.push('ev.voucher_date >= ?');
    params.push(query.from);
  }
  if (query.to) {
    clauses.push('ev.voucher_date <= ?');
    params.push(query.to);
  }
  return { clause: `WHERE ${clauses.join(' AND ')}`, params };
}

// Row-level listing for the report table (Voucher Number, Date, Head, BU,
// Payment Method, Paid To, Amount, Remarks).
async function getRows(filters) {
  const { clause, params } = buildFilters(filters);
  const [rows] = await pool.query(
    `SELECT ev.voucher_number, ev.voucher_date, eh.head AS expense_head, bu.name AS business_unit,
            ev.payment_method, ev.paid_to, ev.amount, ev.details AS remarks
     FROM expense_vouchers ev
     LEFT JOIN expense_heads eh ON eh.id = ev.head_id
     LEFT JOIN business_units bu ON bu.id = ev.business_unit_id
     ${clause}
     ORDER BY ev.voucher_date DESC, ev.id DESC`,
    params
  );
  return rows;
}

// Single aggregate query for the headline totals -- one pass over the
// filtered rows rather than one query per payment method (avoids N+1).
async function getTotals(filters) {
  const { clause, params } = buildFilters(filters);
  const [[row]] = await pool.query(
    `SELECT
       COALESCE(SUM(ev.amount), 0) AS total_expenses,
       COALESCE(SUM(CASE WHEN ev.payment_method = 'cash' THEN ev.amount ELSE 0 END), 0) AS total_cash,
       COALESCE(SUM(CASE WHEN ev.payment_method = 'bank_transfer' THEN ev.amount ELSE 0 END), 0) AS total_bank,
       COALESCE(SUM(CASE WHEN ev.payment_method = 'cheque' THEN ev.amount ELSE 0 END), 0) AS total_cheque,
       COALESCE(SUM(CASE WHEN ev.payment_method = 'card' THEN ev.amount ELSE 0 END), 0) AS total_card,
       COUNT(*) AS voucher_count
     FROM expense_vouchers ev
     ${clause}`,
    params
  );
  return row;
}

async function getExpenseByHead(filters) {
  const { clause, params } = buildFilters(filters);
  const [rows] = await pool.query(
    `SELECT eh.id AS head_id, eh.head, COALESCE(SUM(ev.amount), 0) AS total
     FROM expense_vouchers ev
     LEFT JOIN expense_heads eh ON eh.id = ev.head_id
     ${clause}
     GROUP BY eh.id, eh.head
     ORDER BY total DESC`,
    params
  );
  return rows;
}

async function getExpenseByBusinessUnit(filters) {
  const { clause, params } = buildFilters(filters);
  const [rows] = await pool.query(
    `SELECT bu.id AS business_unit_id, bu.name AS business_name, COALESCE(SUM(ev.amount), 0) AS total
     FROM expense_vouchers ev
     LEFT JOIN business_units bu ON bu.id = ev.business_unit_id
     ${clause}
     GROUP BY bu.id, bu.name
     ORDER BY total DESC`,
    params
  );
  return rows;
}

async function buildReport(query) {
  const [rows, totals, byHead, byBusinessUnit] = await Promise.all([
    getRows(query),
    getTotals(query),
    getExpenseByHead(query),
    getExpenseByBusinessUnit(query),
  ]);
  return {
    rows,
    summary: {
      total_expenses: totals.total_expenses,
      total_cash: totals.total_cash,
      total_bank: totals.total_bank,
      total_cheque: totals.total_cheque,
      total_card: totals.total_card,
      voucher_count: totals.voucher_count,
      by_head: byHead,
      by_business_unit: byBusinessUnit,
    },
  };
}

const controller = {
  get: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Expense report generated successfully', await buildReport(req.query));
  }),
};

const router = express.Router();


const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('EXPENSE_REPORT'));
router.get('/', controller.get);
// PDF/Excel export (marked "future support" in the spec) hangs off this
// same filtered dataset later -- e.g. GET /export?format=pdf reusing
// buildReport(req.query) -- rather than a separate code path, so exports
// can never disagree with what's shown on screen.

module.exports = router;
