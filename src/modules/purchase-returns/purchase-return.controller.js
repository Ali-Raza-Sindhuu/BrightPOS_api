const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const returnService = require('./purchase-return.service');

exports.list = catchAsync(async (req, res) => {
  const { rows, meta } = await returnService.listReturns(req.query);
  sendResponse(res, 200, 'Purchase returns fetched successfully', rows, meta);
});

exports.getOne = catchAsync(async (req, res) => {
  const ret = await returnService.getReturn(req.params.id);
  sendResponse(res, 200, 'Purchase return fetched successfully', ret);
});

exports.create = catchAsync(async (req, res) => {
  const ret = await returnService.createReturn(req.body);
  sendResponse(res, 201, 'Purchase return recorded successfully', ret);
});

exports.update = catchAsync(async (req, res) => {
  const ret = await returnService.updateReturn(req.params.id, req.body);
  sendResponse(res, 200, 'Purchase return updated successfully', ret);
});

exports.remove = catchAsync(async (req, res) => {
  await returnService.deleteReturn(req.params.id);
  sendResponse(res, 200, 'Purchase return deleted successfully', null);
});
