const express = require('express');
const controller = require('./customer-return.controller');

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('SALES_RETURN'));

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', controller.create);

router.put('/:id', controller.updateNotes);

router.patch('/:id/approve', controller.approve);
router.patch('/:id/reject', controller.reject);
router.patch('/:id/items-received', controller.markItemsReceived);
router.patch('/:id/refunded', controller.markRefunded);
router.patch('/:id/completed', controller.markCompleted);

module.exports = router;