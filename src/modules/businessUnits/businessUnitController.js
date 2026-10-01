const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const service = require('./businessUnitService');

exports.list = catchAsync(async (req, res) => {
  const { rows, meta } = await service.listUnits(req.query);
  sendResponse(res, 200, 'Business units fetched successfully', rows, meta);
});

exports.getOne = catchAsync(async (req, res) => {
  const unit = await service.getUnit(req.params.id);
  sendResponse(res, 200, 'Business unit fetched successfully', unit);
});

exports.create = catchAsync(async (req, res) => {
  const unit = await service.createUnit(req.body);
  sendResponse(res, 201, 'Business unit created successfully', unit);
});

exports.update = catchAsync(async (req, res) => {
  const unit = await service.updateUnit(req.params.id, req.body);
  sendResponse(res, 200, 'Business unit updated successfully', unit);
});

exports.remove = catchAsync(async (req, res) => {
  await service.deleteUnit(req.params.id);
  sendResponse(res, 200, 'Business unit deleted successfully', null);
});
