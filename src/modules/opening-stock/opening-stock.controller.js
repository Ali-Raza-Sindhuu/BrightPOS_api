const service = require('./opening-stock.service');
const asyncHandler = require('../../utils/async-handler');
const sendResponse = require('../../utils/send-response');
const ApiError = require('../../utils/api-error');
exports.createOpeningStock = asyncHandler(async (req, res) => {
  const data = await service.createOpeningStock({ ...req.body, created_by: req.user.id });
  sendResponse(res, 201, 'Opening stock recorded successfully', data);
});
exports.getOpeningStockList = asyncHandler(async (req, res) => {
  const { rows, meta } = await service.getOpeningStockList(req.query);
  sendResponse(res, 200, 'Opening stock list fetched successfully', rows, meta);
});
exports.getOpeningStockById = asyncHandler(async (req, res) => {
  const data = await service.getOpeningStockById(req.params.id);
  if (!data) throw new ApiError(404, 'Opening stock entry not found');
  sendResponse(res, 200, 'Opening stock fetched successfully', data);
});
exports.deleteOpeningStock = asyncHandler(async (req, res) => {
  await service.deleteOpeningStock(req.params.id, req.user.id);
  sendResponse(res, 200, 'Opening stock reversed successfully', Number(req.params.id));
});
exports.getItemStockByBranch = asyncHandler(async (req, res) => {
  sendResponse(res, 200, 'Item stock fetched successfully', await service.getItemStockByBranch(req.params.business_unit_id));
});
