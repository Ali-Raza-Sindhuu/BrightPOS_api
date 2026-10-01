const express = require("express");
const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('ITEM_SUBCATEGORY'));
const subCategoryController = require("./subCategoryController");

// GET  /api/sub-categories?page=&limit=&search=&category_id=
// POST /api/sub-categories
router.route("/").get(subCategoryController.getAll).post(subCategoryController.create);

router
  .route("/:id")
  .get(subCategoryController.getOne)
  .put(subCategoryController.update)
  .delete(subCategoryController.remove);

module.exports = router;
