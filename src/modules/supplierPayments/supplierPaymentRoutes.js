const express = require('express');
const controller = require('./supplierPaymentController');
// const { protect, checkPermission } = require('../../middlewares/rbac'); // attach when RBAC is wired in

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('SUPPLIER_ACCOUNT'));

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
