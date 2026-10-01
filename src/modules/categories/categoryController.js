const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const categoryService = require("./categoryServices");

const getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await categoryService.listCategories(req.query);
  return success(res, 200, "Categories fetched successfully", rows, meta);
});

const getOne = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategory(req.params.id);
  return success(res, 200, "Category fetched successfully", category);
});

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  return success(res, 201, "Category created successfully", category);
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  return success(res, 200, "Category updated successfully", category);
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  return success(res, 200, "Category deleted successfully", null);
});

module.exports = { getAll, getOne, create, update, remove };
