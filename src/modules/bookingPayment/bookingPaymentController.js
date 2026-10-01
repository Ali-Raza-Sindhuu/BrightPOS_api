const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const service = require('./bookingPaymentService');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.list(req.query);

  sendResponse(
    res,
    200,
    'Booking payments fetched successfully',
    rows,
    meta
  );
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.get(req.params.id);

  sendResponse(
    res,
    200,
    'Booking payment fetched successfully',
    row
  );
});

const create = catchAsync(async (req, res) => {
  const row = await service.create(req.body);

  sendResponse(
    res,
    201,
    'Booking payment recorded successfully',
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
    'Booking payment updated successfully',
    row
  );
});

const remove = catchAsync(async (req, res) => {
  await service.remove(req.params.id);

  sendResponse(
    res,
    200,
    'Booking payment deleted successfully',
    null
  );
});

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};