const pool = require('../../config/db');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const ApiError = require('../../utils/ApiError');
const express = require('express');

async function getSupplierLedger(supplierId) {
  const [[supplier]] = await pool.query(
    'SELECT id, supplier_name, opening_balance FROM suppliers WHERE id = ?',
    [supplierId]
  );
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const [purchases] = await pool.query(
    `SELECT id, created_at AS date, invoice_no AS voucher_no, payable AS debit, 0 AS credit,
            'Purchase' AS module, CONCAT('Purchase Invoice - ', COALESCE(invoice_no, CONCAT('PO-', id))) AS description
     FROM purchases WHERE supplier_id = ?`,
    [supplierId]
  );

  const [returns] = await pool.query(
    `SELECT id, return_date AS date, id AS voucher_no, 0 AS debit, total_amount AS credit,
            'Purchase Return' AS module, CONCAT('Purchase Return - RTN-', id) AS description
     FROM purchase_returns WHERE supplier_id = ?`,
    [supplierId]
  );

  const [payments] = await pool.query(
    `SELECT id, payment_date AS date, id AS voucher_no, 0 AS debit, amount AS credit,
            'Payment' AS module, CONCAT('Payment - ', payment_method) AS description
     FROM supplier_payments WHERE supplier_id = ?`,
    [supplierId]
  );

  const openingEntry = {
    id: 'opening',
    date: null, // sorts first regardless of date
    voucher_no: 'OB',
    module: 'Opening Balance',
    description: 'Opening Balance',
    debit: Number(supplier.opening_balance) > 0 ? Number(supplier.opening_balance) : 0,
    credit: Number(supplier.opening_balance) < 0 ? Math.abs(Number(supplier.opening_balance)) : 0,
  };

  const transactionEntries = [...purchases, ...returns, ...payments]
    .map((e) => ({ ...e, debit: Number(e.debit), credit: Number(e.credit) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const allEntries = [openingEntry, ...transactionEntries];

  let balance = 0;
  const ledger = allEntries.map((entry) => {
    balance += entry.debit - entry.credit;
    return { ...entry, balance };
  });

  return { ledger, closingBalance: balance, supplierName: supplier.supplier_name };
}

const controller = {
  getSupplierLedger: catchAsync(async (req, res) => {
    const result = await getSupplierLedger(req.params.id);
    sendResponse(res, 200, 'Supplier ledger fetched successfully', result);
  }),
};

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('SUPPLIER_ACCOUNT'));
router.get('/:id', controller.getSupplierLedger);

module.exports = router;