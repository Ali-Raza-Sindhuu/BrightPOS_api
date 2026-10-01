const itemUnitModel = require("./itemUnitsModel");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await itemUnitModel.findAll({ limit, offset, search: query.search });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const record = await itemUnitModel.findById(id);
  if (!record) throw new ApiError(404, "Item unit not found");
  return record;
};

const create = async (data) => {
  if (!data.unit_name || !data.unit_name.trim()) throw new ApiError(400, "unit_name is required");
  const existing = await itemUnitModel.findByName(data.unit_name.trim());
  if (existing) throw new ApiError(409, "Item unit with this name already exists");
  return itemUnitModel.create({ ...data, unit_name: data.unit_name.trim() });
};

const update = async (id, data) => {
  await getOne(id);
  if (data.unit_name !== undefined) {
    if (!data.unit_name.trim()) throw new ApiError(400, "unit_name cannot be empty");
    const existing = await itemUnitModel.findByName(data.unit_name.trim(), id);
    if (existing) throw new ApiError(409, "Item unit with this name already exists");
    data.unit_name = data.unit_name.trim();
  }
  return itemUnitModel.update(id, data);
};

const remove = async (id) => {
  await getOne(id);
  const count = await itemUnitModel.countUsage(id);
  if (count > 0) throw new ApiError(409, `Cannot delete: ${count} records use this item unit`);
  return itemUnitModel.remove(id);
};

module.exports = { list, getOne, create, update, remove };
