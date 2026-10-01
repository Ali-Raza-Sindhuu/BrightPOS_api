const express = require('express');
const controller = require('./business-unit.controller');
// const { protect, checkPermission } = require('../../middlewares/rbac'); // attach when RBAC is wired in

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const authenticate = require('../../middleware/authentication');
const requireAdmin = require('../../middleware/require-admin');
const { requirePermission } = require('../access-control/require-permission');

router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, requirePermission('ACCESS.SALES.READ'), controller.getOne);
router.post('/', authenticate, requireAdmin, controller.create);
router.put('/:id', authenticate, requireAdmin, controller.update);
router.delete('/:id', authenticate, requireAdmin, controller.remove);

module.exports = router;
