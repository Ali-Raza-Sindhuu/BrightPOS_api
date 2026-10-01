const express = require('express');
const controller = require('./reorderController');

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('REORDER_STOCK'));

router.get('/', controller.list);
router.get('/suggestions', controller.suggestions);
router.get('/:id', controller.getOne);

router.post('/', controller.create);

router.put('/:id', controller.updateNotes);

router.patch('/:id/mark-ordered', controller.markOrdered);
router.patch('/:id/mark-received', controller.markReceived);

router.delete('/:id', controller.remove);

module.exports = router;