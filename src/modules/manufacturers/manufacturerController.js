const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("./manufacturerService");

const getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await service.list(req.query);
  return success(res, 200, "Manufacturers fetched successfully", rows, meta);
});

const getOne = asyncHandler(async (req, res) => {
  const record = await service.getOne(req.params.id);
  return success(res, 200, "Manufacturer fetched successfully", record);
});

const create = asyncHandler(async (req, res) => {
  const record = await service.create(req.body);
  return success(res, 201, "Manufacturer created successfully", record);
});

const update = asyncHandler(async (req, res) => {
  const record = await service.update(req.params.id, req.body);
  return success(res, 200, "Manufacturer updated successfully", record);
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return success(res, 200, "Manufacturer deleted successfully", null);
});

module.exports = { getAll, getOne, create, update, remove };
