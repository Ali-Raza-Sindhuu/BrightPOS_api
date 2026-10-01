const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const service = require('./bookingService');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.listBookings(req.query);

  sendResponse(
    res,
    200,
    'Bookings fetched successfully',
    rows,
    meta
  );
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.getBooking(req.params.id);

  sendResponse(
    res,
    200,
    'Booking fetched successfully',
    row
  );
});

const create = catchAsync(async (req, res) => {
  const row = await service.createBooking(req.body);

  sendResponse(
    res,
    201,
    'Booking created successfully',
    row
  );
});

const update = catchAsync(async (req, res) => {
  const row = await service.updateBooking(
    req.params.id,
    req.body
  );

  sendResponse(
    res,
    200,
    'Booking updated successfully',
    row
  );
});

const complete = catchAsync(async (req, res) => {
  const row = await service.completeBooking(req.params.id);

  sendResponse(
    res,
    200,
    'Booking completed successfully',
    row
  );
});

const reject = catchAsync(async (req, res) => {
  const row = await service.rejectBooking(req.params.id);

  sendResponse(
    res,
    200,
    'Booking rejected',
    row
  );
});

const remove = catchAsync(async (req, res) => {
  await service.deleteBooking(req.params.id);

  sendResponse(
    res,
    200,
    'Booking deleted successfully',
    null
  );
});

module.exports = {
  list,
  getOne,
  create,
  update,
  complete,
  reject,
  remove,
};