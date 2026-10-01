const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("./itemsServices");
const { storeItemImage } = require("../../middleware/upload");

const getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await service.list(req.query);
  return success(res, 200, "Items fetched successfully", rows, meta);
});

const getLowStock = asyncHandler(async (req, res) => {
  const rows = await service.getLowStock(req.query.business_unit_id); // NEW
  return success(res, 200, "Low stock items fetched successfully", rows);
});

const getOne = asyncHandler(async (req, res) => {
  const record = await service.getOne(req.params.id, req.query.business_unit_id); // NEW
  return success(res, 200, "Item fetched successfully", record);
});

const create = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
  };

  if (req.file) {
    data.item_image_url = await storeItemImage(req.file);
  }

  const record = await service.create(data);

  return success(res, 201, "Item created successfully", record);
});

const update = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
  };

  if (req.file) {
    data.item_image_url = await storeItemImage(req.file);
  }

  const record = await service.update(req.params.id, data);

  return success(res, 200, "Item updated successfully", record);
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return success(res, 200, "Item deleted successfully", null);
});

module.exports = {
  getAll,
  getOne,
  create,
  update,
  remove,
  getLowStock,
};
