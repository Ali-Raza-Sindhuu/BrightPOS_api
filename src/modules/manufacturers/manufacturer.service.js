const manufacturerModel = require("./manufacturer.model");
const ApiError = require("../../utils/api-error");
const { getPagination, buildMeta } = require("../../utils/pagination");

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await manufacturerModel.findAll({ limit, offset, search: query.search });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const record = await manufacturerModel.findById(id);
  if (!record) throw new ApiError(404, "Manufacturer not found");
  return record;
};

const create = async (data) => {
  if (!data.manufacturer_id || !data.manufacturer_id.trim()) {
    throw new ApiError(400, "manufacturer_id (code) is required");
  }
  if (!data.manufacturer_name || !data.manufacturer_name.trim()) {
    throw new ApiError(400, "manufacturer_name is required");
  }

  const existing = await manufacturerModel.findByCode(data.manufacturer_id.trim());
  if (existing) throw new ApiError(409, "Manufacturer with this code already exists");

  return manufacturerModel.create({
    ...data,
    manufacturer_id: data.manufacturer_id.trim(),
    manufacturer_name: data.manufacturer_name.trim(),
  });
};

const update = async (id, data) => {
  await getOne(id);

  if (data.manufacturer_id !== undefined) {
    if (!data.manufacturer_id.trim()) throw new ApiError(400, "manufacturer_id cannot be empty");
    const existing = await manufacturerModel.findByCode(data.manufacturer_id.trim(), id);
    if (existing) throw new ApiError(409, "Manufacturer with this code already exists");
    data.manufacturer_id = data.manufacturer_id.trim();
  }
  if (data.manufacturer_name !== undefined && !data.manufacturer_name.trim()) {
    throw new ApiError(400, "manufacturer_name cannot be empty");
  }

  return manufacturerModel.update(id, data);
};

const remove = async (id) => {
  await getOne(id);
  const count = await manufacturerModel.countItems(id);
  if (count > 0) throw new ApiError(409, `Cannot delete: ${count} items use this manufacturer`);
  return manufacturerModel.remove(id);
};

module.exports = { list, getOne, create, update, remove };
