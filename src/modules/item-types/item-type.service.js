const itemTypeModel = require("./item-type.model");
const ApiError = require("../../utils/api-error");
const { getPagination, buildMeta } = require("../../utils/pagination");

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await itemTypeModel.findAll({ limit, offset, search: query.search });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const record = await itemTypeModel.findById(id);
  if (!record) throw new ApiError(404, "Item type not found");
  return record;
};

const create = async (data) => {
  if (!data.type_name || !data.type_name.trim()) throw new ApiError(400, "type_name is required");
  const existing = await itemTypeModel.findByName(data.type_name.trim());
  if (existing) throw new ApiError(409, "Item type with this name already exists");
  return itemTypeModel.create({ ...data, type_name: data.type_name.trim() });
};

const update = async (id, data) => {
  await getOne(id);
  if (data.type_name !== undefined) {
    if (!data.type_name.trim()) throw new ApiError(400, "type_name cannot be empty");
    const existing = await itemTypeModel.findByName(data.type_name.trim(), id);
    if (existing) throw new ApiError(409, "Item type with this name already exists");
    data.type_name = data.type_name.trim();
  }
  return itemTypeModel.update(id, data);
};

const remove = async (id) => {
  await getOne(id);
  const count = await itemTypeModel.countItems(id);
  if (count > 0) throw new ApiError(409, `Cannot delete: ${count} items use this item type`);
  return itemTypeModel.remove(id);
};

module.exports = { list, getOne, create, update, remove };
