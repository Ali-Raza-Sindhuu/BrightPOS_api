const express = require('express');
const controller = require('./customerReturnController');

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
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