const express = require('express');
const controller = require('./businessUnitController');
// const { protect, checkPermission } = require('../../middlewares/rbac'); // attach when RBAC is wired in

const router = express.Router();

const authenticate = require('../../middleware/authentication');
const requireAdmin = require('../../middleware/requireAdmin');
const { requirePermission } = require('../accessControl/requirePermission');

router.get('/', authenticate, requirePermission('ACCESS.SALES.READ'), controller.list);
router.get('/:id', authenticate, requirePermission('ACCESS.SALES.READ'), controller.getOne);
router.post('/', authenticate, requireAdmin, controller.create);
router.put('/:id', authenticate, requireAdmin, controller.update);
router.delete('/:id', authenticate, requireAdmin, controller.remove);

module.exports = router;
