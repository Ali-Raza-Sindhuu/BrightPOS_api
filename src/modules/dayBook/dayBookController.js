const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const service = require('./daybookService');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.list(req.query);

  sendResponse(
    res,
    200,
    'Daybook entries fetched successfully',
    rows,
    meta
  );
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.get(req.params.id);

  sendResponse(
    res,
    200,
    'Daybook entry fetched successfully',
    row
  );
});

const create = catchAsync(async (req, res) => {
  const row = await service.create(req.body);

  sendResponse(
    res,
    201,
    'Daybook entry recorded successfully',
    row
  );
});

module.exports = {
  list,
  getOne,
  create,
};