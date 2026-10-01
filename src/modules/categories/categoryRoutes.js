const express = require("express");
const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('ITEM_CATEGORY'));
const categoryController = require("./categoryController");

// GET    /api/categories?page=&limit=&search=
// POST   /api/categories
router.route("/").get(categoryController.getAll).post(categoryController.create);

// GET    /api/categories/:id
// PUT    /api/categories/:id
// DELETE /api/categories/:id
router
  .route("/:id")
  .get(categoryController.getOne)
  .put(categoryController.update)
  .delete(categoryController.remove);

module.exports = router;
