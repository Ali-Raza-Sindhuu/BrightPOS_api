const express = require('express');
const controller = require('./reorder.controller');

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
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