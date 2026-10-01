const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const service = require('./customerReturnService');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.list(req.query);
  sendResponse(res, 200, 'Customer returns fetched successfully', rows, meta);
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.get(req.params.id);
  sendResponse(res, 200, 'Customer return fetched successfully', row);
});

const create = catchAsync(async (req, res) => {
  const row = await service.create(req.body);
  sendResponse(res, 201, 'Customer return created successfully', row);
});

const updateNotes = catchAsync(async (req, res) => {
  const row = await service.updateNotes(req.params.id, req.body.notes);
  sendResponse(res, 200, 'Customer return updated successfully', row);
});

const approve = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'approved');
  sendResponse(res, 200, 'Customer return approved', row);
});

const reject = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'rejected');
  sendResponse(res, 200, 'Customer return rejected', row);
});

const markItemsReceived = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'items_received');
  sendResponse(res, 200, 'Items marked as received', row);
});

const markRefunded = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'refunded');
  sendResponse(res, 200, 'Return marked as refunded', row);
});

const markCompleted = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'completed');
  sendResponse(res, 200, 'Return marked as completed', row);
});

module.exports = {
  list,
  getOne,
  create,
  updateNotes,
  approve,
  reject,
  markItemsReceived,
  markRefunded,
  markCompleted,
};