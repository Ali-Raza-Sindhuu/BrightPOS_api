const express = require("express");
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('ITEM_CATEGORY'));
const categoryController = require("./category.controller");

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
