const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const returnService = require('./returnService');

exports.list = catchAsync(async (req, res) => {
  const { rows, meta } = await returnService.listReturns(req.query);
  sendResponse(res, 200, 'Sale returns fetched successfully', rows, meta);
});

exports.getOne = catchAsync(async (req, res) => {
  const ret = await returnService.getReturn(req.params.id);
  sendResponse(res, 200, 'Sale return fetched successfully', ret);
});

exports.create = catchAsync(async (req, res) => {
  const ret = await returnService.createReturn(req.body);
  sendResponse(res, 201, 'Sale return recorded successfully', ret);
});

exports.update = catchAsync(async (req, res) => {
  const ret = await returnService.updateReturn(req.params.id, req.body);
  sendResponse(res, 200, 'Sale return updated successfully', ret);
});

exports.remove = catchAsync(async (req, res) => {
  await returnService.deleteReturn(req.params.id);
  sendResponse(res, 200, 'Sale return deleted successfully', null);
});
