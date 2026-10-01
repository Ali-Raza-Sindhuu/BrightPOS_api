const express = require("express");
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('ITEM_SUBCATEGORY'));
const subCategoryController = require("./sub-category.controller");

// GET  /api/sub-categories?page=&limit=&search=&category_id=
// POST /api/sub-categories
router.route("/").get(subCategoryController.getAll).post(subCategoryController.create);

router
  .route("/:id")
  .get(subCategoryController.getOne)
  .put(subCategoryController.update)
  .delete(subCategoryController.remove);

module.exports = router;
