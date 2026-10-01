const express = require('express');
const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');
const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const buildCrudModule = require('../../utils/build-crud-module');

// buildCrudModule still handles list/get/create/update/delete-with-guard --
// that part of your generic CRUD builder was already correct (parameterized
// queries, partial updates via `columns.filter(c => data[c] !== undefined)`,
// and the reference-count delete guard). We only add what the spec asks for
// that the generic builder doesn't know about: expense_code, status, and a
// deactivate/activate action instead of relying on hard delete.
const { model, service, controller } = buildCrudModule({
  table: 'expense_heads',
  columns: ['head', 'expense_code', 'description', 'status'],
  requiredOnCreate: ['head', 'expense_code'],
  searchColumns: ['head', 'expense_code'],
  uniqueColumn: 'head',
  entityName: 'Expense head',
  references: [{ table: 'expense_vouchers', column: 'head_id' }],
});

// expense_code needs the same uniqueness check the generic builder gives
// `head`, but buildCrudModule only supports one uniqueColumn. Wrap create/
// update to add the second check rather than modifying the shared builder.
async function assertCodeUnique(code, excludeId = null) {
  if (!code) return;
  const params = [code];
  let query = 'SELECT id FROM expense_heads WHERE expense_code = ?';
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(query, params);
  if (rows.length) throw new ApiError(409, `An expense head with expense_code "${code}" already exists`);
}

const create = catchAsync(async (req, res) => {
  await assertCodeUnique(req.body.expense_code);
  const row = await service.create({ ...req.body, status: req.body.status ?? 'active' });
  sendResponse(res, 201, 'Expense head created successfully', row);
});

const update = catchAsync(async (req, res) => {
  await assertCodeUnique(req.body.expense_code, req.params.id);
  const row = await service.update(req.params.id, req.body);
  sendResponse(res, 200, 'Expense head updated successfully', row);
});

// Deactivate/activate are explicit actions, not a generic field update --
// this matches the spec ("Deactivate Expense Head", not "delete") and
// keeps the state change auditable/intentional rather than something that
// can slip through as a side effect of an unrelated PUT.
async function setStatus(id, status) {
  const head = await service.get(id); // 404s if missing
  if (head.status === status) return head;
  await pool.query('UPDATE expense_heads SET status = ? WHERE id = ?', [status, id]);
  return model.findById(id);
}

const deactivate = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Expense head deactivated successfully', await setStatus(req.params.id, 'inactive'));
});

const activate = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Expense head activated successfully', await setStatus(req.params.id, 'active'));
});

// Built by hand (not buildRouter()) so create/update route to the
// code-aware handlers above instead of the generic ones.
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('EXPENSE_HEAD'));
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', controller.remove);
router.patch('/:id/deactivate', deactivate);
router.patch('/:id/activate', activate);
// Hard DELETE stays available (still guarded by the reference check in
// buildCrudModule) for genuinely-unused heads created by mistake; day-to-day
// retirement of a head that's already in use should go through deactivate.

module.exports = router;