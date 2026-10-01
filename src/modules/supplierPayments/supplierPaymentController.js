const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const paymentService = require('./supplierPaymentservice');

exports.list = catchAsync(async (req, res) => {
  const { rows, meta } = await paymentService.listPayments(req.query);
  sendResponse(res, 200, 'Payments fetched successfully', rows, meta);
});

exports.getOne = catchAsync(async (req, res) => {
  const payment = await paymentService.getPayment(req.params.id);
  sendResponse(res, 200, 'Payment fetched successfully', payment);
});

exports.create = catchAsync(async (req, res) => {
  const payment = await paymentService.createPayment(req.body);
  sendResponse(res, 201, 'Payment recorded successfully', payment);
});

exports.update = catchAsync(async (req, res) => {
  const payment = await paymentService.updatePayment(req.params.id, req.body);
  sendResponse(res, 200, 'Payment updated successfully', payment);
});

exports.remove = catchAsync(async (req, res) => {
  await paymentService.deletePayment(req.params.id);
  sendResponse(res, 200, 'Payment deleted successfully', null);
});
