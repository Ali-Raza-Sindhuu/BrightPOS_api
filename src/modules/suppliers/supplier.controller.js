const asyncHandler = require("../../utils/async-handler");
const { success } = require("../../utils/api-response");
const service = require("./supplier.service");

const getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await service.list(req.query);
  return success(res, 200, "Suppliers fetched successfully", rows, meta);
});

const getOne = asyncHandler(async (req, res) => {
  const record = await service.getOne(req.params.id);
  return success(res, 200, "Supplier fetched successfully", record);
});

const create = asyncHandler(async (req, res) => {
  const record = await service.create(req.body);
  return success(res, 201, "Supplier created successfully", record);
});

const update = asyncHandler(async (req, res) => {
  const record = await service.update(req.params.id, req.body);
  return success(res, 200, "Supplier updated successfully", record);
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return success(res, 200, "Supplier deleted successfully", null);
});

module.exports = { getAll, getOne, create, update, remove };
