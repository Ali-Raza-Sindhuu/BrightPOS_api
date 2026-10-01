const asyncHandler = require("../../utils/async-handler");
const { success } = require("../../utils/api-response");
const subCategoryService = require("./sub-category.service");

const getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await subCategoryService.listSubCategories(req.query);
  return success(res, 200, "Sub-categories fetched successfully", rows, meta);
});

const getOne = asyncHandler(async (req, res) => {
  const subCategory = await subCategoryService.getSubCategory(req.params.id);
  return success(res, 200, "Sub-category fetched successfully", subCategory);
});

const create = asyncHandler(async (req, res) => {
  const subCategory = await subCategoryService.createSubCategory(req.body);
  return success(res, 201, "Sub-category created successfully", subCategory);
});

const update = asyncHandler(async (req, res) => {
  const subCategory = await subCategoryService.updateSubCategory(req.params.id, req.body);
  return success(res, 200, "Sub-category updated successfully", subCategory);
});

const remove = asyncHandler(async (req, res) => {
  await subCategoryService.deleteSubCategory(req.params.id);
  return success(res, 200, "Sub-category deleted successfully", null);
});

module.exports = { getAll, getOne, create, update, remove };
