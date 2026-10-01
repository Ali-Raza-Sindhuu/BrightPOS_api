const catchAsync = require("../../utils/catchAsync");
const sendResponse = require("../../utils/sendResponse");
const saleService = require("./saleService");

exports.list = catchAsync(async (req, res) => {
  const { rows, meta } = await saleService.listSales(req.query);
  sendResponse(res, 200, "Sale invoices fetched successfully", rows, meta);
});

exports.getOne = catchAsync(async (req, res) => {
  const invoice = await saleService.getSale(req.params.id);
  sendResponse(res, 200, "Sale invoice fetched successfully", invoice);
});

exports.create = catchAsync(async (req, res) => {
  const invoice = await saleService.createSale(req.body);
  sendResponse(res, 201, "Sale invoice created successfully", invoice);
});

exports.update = catchAsync(async (req, res) => {
  const invoice = await saleService.updateSale(req.params.id, req.body);
  sendResponse(res, 200, "Sale invoice updated successfully", invoice);
});

exports.remove = catchAsync(async (req, res) => {
  await saleService.deleteSale(req.params.id);
  sendResponse(res, 200, "Sale invoice deleted successfully", null);
});

exports.getNextReceipt = catchAsync(async (req, res) => {
  const receipt = await saleService.getNextReceipt();

  sendResponse(
    res,
    200,
    "Next receipt fetched successfully",
    { receipt_no: receipt }
  );
});

exports.getSummary = catchAsync(async (req, res) => {
  const summary = await saleService.getSalesSummary(req.query);
  sendResponse(res, 200, "Sales summary fetched successfully", summary);
});