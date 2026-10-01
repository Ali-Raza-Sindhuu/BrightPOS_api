const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const service = require('./reorder.service');

const list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.list(req.query);
  sendResponse(res, 200, 'Reorders fetched successfully', rows, meta);
});

const suggestions = catchAsync(async (req, res) => {
  const rows = await service.listSuggestions();
  sendResponse(res, 200, 'Reorder suggestions fetched successfully', rows);
});

const getOne = catchAsync(async (req, res) => {
  const row = await service.get(req.params.id);
  sendResponse(res, 200, 'Reorder fetched successfully', row);
});

const create = catchAsync(async (req, res) => {
  const row = await service.create(req.body);
  sendResponse(res, 201, 'Reorder created successfully', row);
});

const updateNotes = catchAsync(async (req, res) => {
  const row = await service.updateNotes(req.params.id, req.body.notes);
  sendResponse(res, 200, 'Reorder updated successfully', row);
});

const markOrdered = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'Ordered');
  sendResponse(res, 200, 'Reorder marked as Ordered', row);
});

const markReceived = catchAsync(async (req, res) => {
  const row = await service.transition(req.params.id, 'Received');
  sendResponse(res, 200, 'Reorder marked as Received', row);
});

const remove = catchAsync(async (req, res) => {
  await service.remove(req.params.id);
  sendResponse(res, 200, 'Reorder deleted successfully', null);
});

module.exports = {
  list,
  suggestions,
  getOne,
  create,
  updateNotes,
  markOrdered,
  markReceived,
  remove,
};