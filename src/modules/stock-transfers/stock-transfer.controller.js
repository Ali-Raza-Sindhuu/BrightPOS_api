const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const service = require('./stock-transfer.service');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.list(req.query);

  sendResponse(
    res,
    200,
    'Stock transfers fetched successfully',
    rows,
    meta
  );
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.get(req.params.id);

  sendResponse(
    res,
    200,
    'Stock transfer fetched successfully',
    row
  );
});

const create = catchAsync(async (req, res) => {
  const row = await service.create(req.body);

  sendResponse(
    res,
    201,
    'Stock transfer recorded successfully',
    row
  );
});

const remove = catchAsync(async (req, res) => {
  await service.remove(req.params.id);

  sendResponse(
    res,
    200,
    'Stock transfer reversed and deleted successfully',
    null
  );
});

module.exports = {
  list,
  getOne,
  create,
  remove,
};