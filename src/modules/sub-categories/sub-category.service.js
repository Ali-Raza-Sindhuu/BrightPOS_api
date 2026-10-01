const subCategoryModel = require("./sub-category.model");
const categoryModel = require("../categories/category.model");
const ApiError = require("../../utils/api-error");
const { getPagination, buildMeta } = require("../../utils/pagination");

const listSubCategories = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await subCategoryModel.findAll({
    limit,
    offset,
    search: query.search,
    category_id: query.category_id,
  });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getSubCategory = async (id) => {
  const subCategory = await subCategoryModel.findById(id);
  if (!subCategory) throw new ApiError(404, "Sub-category not found");
  return subCategory;
};

const assertCategoryExists = async (category_id) => {
  const category = await categoryModel.findById(category_id);
  if (!category) throw new ApiError(400, "Parent category does not exist");
};

const createSubCategory = async (data) => {
  if (!data.category_id) throw new ApiError(400, "category_id is required");
  if (!data.sub_category_name || !data.sub_category_name.trim()) {
    throw new ApiError(400, "sub_category_name is required");
  }

  await assertCategoryExists(data.category_id);

  const existing = await subCategoryModel.findByNameInCategory(
    data.sub_category_name.trim(),
    data.category_id
  );
  if (existing) {
    throw new ApiError(409, "Sub-category with this name already exists in this category");
  }

  return subCategoryModel.create({
    category_id: data.category_id,
    sub_category_name: data.sub_category_name.trim(),
    is_enable: data.is_enable !== undefined ? data.is_enable : 1,
  });
};

const updateSubCategory = async (id, data) => {
  const current = await getSubCategory(id);

  if (data.category_id !== undefined) {
    await assertCategoryExists(data.category_id);
  }
  if (data.sub_category_name !== undefined) {
    if (!data.sub_category_name.trim()) {
      throw new ApiError(400, "sub_category_name cannot be empty");
    }
    const categoryId = data.category_id !== undefined ? data.category_id : current.category_id;
    const existing = await subCategoryModel.findByNameInCategory(
      data.sub_category_name.trim(),
      categoryId,
      id
    );
    if (existing) {
      throw new ApiError(409, "Sub-category with this name already exists in this category");
    }
    data.sub_category_name = data.sub_category_name.trim();
  }

  return subCategoryModel.update(id, data);
};

const deleteSubCategory = async (id) => {
  await getSubCategory(id);

  const itemCount = await subCategoryModel.countItems(id);
  if (itemCount > 0) {
    throw new ApiError(409, `Cannot delete sub-category: ${itemCount} items are linked to it`);
  }

  return subCategoryModel.remove(id);
};

module.exports = {
  listSubCategories,
  getSubCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
};
