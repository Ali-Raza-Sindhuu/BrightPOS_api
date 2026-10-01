const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("./goodsReceiptService");

const getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await service.list(req.query);
  return success(res, 200, "Goods receipts fetched successfully", rows, meta);
});

const getOne = asyncHandler(async (req, res) => {
  const record = await service.getOne(req.params.id);
  return success(res, 200, "Goods receipt fetched successfully", record);
});

const receive = asyncHandler(async (req, res) => {
  const record = await service.receiveGrn(req.params.id, req.body);
  return success(res, 200, "Goods receipt marked as received — stock updated", record);
});

module.exports = { getAll, getOne, receive };
