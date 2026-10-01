const categoryModel = require("./categoryModel");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

const listCategories = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await categoryModel.findAll({
    limit,
    offset,
    search: query.search,
  });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getCategory = async (id) => {
  const category = await categoryModel.findById(id);
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

const createCategory = async (data) => {
  if (!data.category_name || !data.category_name.trim()) {
    throw new ApiError(400, "category_name is required");
  }

  const existing = await categoryModel.findByName(data.category_name.trim());
  if (existing) throw new ApiError(409, "Category with this name already exists");

  return categoryModel.create({
    category_name: data.category_name.trim(),
    is_enable: data.is_enable !== undefined ? data.is_enable : 1,
  });
};

const updateCategory = async (id, data) => {
  await getCategory(id); // ensures exists

  if (data.category_name !== undefined) {
    if (!data.category_name.trim()) {
      throw new ApiError(400, "category_name cannot be empty");
    }
    const existing = await categoryModel.findByName(data.category_name.trim(), id);
    if (existing) throw new ApiError(409, "Category with this name already exists");
    data.category_name = data.category_name.trim();
  }

  return categoryModel.update(id, data);
};

const deleteCategory = async (id) => {
  await getCategory(id); // ensures exists

  const subCount = await categoryModel.countSubCategories(id);
  if (subCount > 0) {
    throw new ApiError(
      409,
      `Cannot delete category: ${subCount} sub-categories are linked to it`
    );
  }

  return categoryModel.remove(id);
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
