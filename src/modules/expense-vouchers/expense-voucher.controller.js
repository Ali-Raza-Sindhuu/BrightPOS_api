const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const service = require('./expense-voucher.service');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.list(req.query);

  sendResponse(
    res,
    200,
    'Expense vouchers fetched successfully',
    rows,
    meta
  );
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.get(req.params.id);

  sendResponse(
    res,
    200,
    'Expense voucher fetched successfully',
    row
  );
});

const create = catchAsync(async (req, res) => {
  const row = await service.create({ ...req.body, created_by: req.user.id });

  sendResponse(
    res,
    201,
    'Expense voucher recorded successfully',
    row
  );
});

const update = catchAsync(async (req, res) => {
  const row = await service.update(
    req.params.id,
    req.body
  );

  sendResponse(
    res,
    200,
    'Expense voucher updated successfully',
    row
  );
});

module.exports = {
  list,
  getOne,
  create,
  update,
};