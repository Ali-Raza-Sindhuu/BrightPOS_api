const model = require("./shelveLocationModel");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await model.findAll({ limit, offset, search: query.search });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const record = await model.findById(id);
  if (!record) throw new ApiError(404, "Shelve location not found");
  return record;
};

const create = async (data) => {
  if (!data.shelf_name_code || !data.shelf_name_code.trim()) {
    throw new ApiError(400, "shelf_name_code is required");
  }
  const existing = await model.findByCode(data.shelf_name_code.trim());
  if (existing) throw new ApiError(409, "Shelve location with this code already exists");
  return model.create({ ...data, shelf_name_code: data.shelf_name_code.trim() });
};

const update = async (id, data) => {
  await getOne(id);
  if (data.shelf_name_code !== undefined) {
    if (!data.shelf_name_code.trim()) throw new ApiError(400, "shelf_name_code cannot be empty");
    const existing = await model.findByCode(data.shelf_name_code.trim(), id);
    if (existing) throw new ApiError(409, "Shelve location with this code already exists");
    data.shelf_name_code = data.shelf_name_code.trim();
  }
  return model.update(id, data);
};

const remove = async (id) => {
  await getOne(id);
  const count = await model.countItems(id);
  if (count > 0) throw new ApiError(409, `Cannot delete: ${count} items use this shelve location`);
  return model.remove(id);
};

module.exports = { list, getOne, create, update, remove };
