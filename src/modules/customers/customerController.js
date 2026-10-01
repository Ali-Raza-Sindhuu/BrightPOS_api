const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const customerService = require('./customerService');

exports.list = catchAsync(async (req, res) => {
  const { rows, meta } = await customerService.listCustomers(req.query);
  sendResponse(res, 200, 'Customers fetched successfully', rows, meta);
});

exports.getOne = catchAsync(async (req, res) => {
  const customer = await customerService.getCustomer(req.params.id);
  sendResponse(res, 200, 'Customer fetched successfully', customer);
});

exports.create = catchAsync(async (req, res) => {
  // console.log(req.body);
  const customer = await customerService.createCustomer(req.body);
  sendResponse(res, 201, 'Customer created successfully', customer);
});

exports.update = catchAsync(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);
  sendResponse(res, 200, 'Customer updated successfully', customer);
});

exports.remove = catchAsync(async (req, res) => {
  await customerService.deleteCustomer(req.params.id);
  sendResponse(res, 200, 'Customer deleted successfully', null);
});
