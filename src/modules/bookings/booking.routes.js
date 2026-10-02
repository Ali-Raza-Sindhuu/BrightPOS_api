const express = require('express');
const controller = require('./booking.controller');

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('BOOKINGS'));
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/complete', controller.complete);
router.patch('/:id/reject', controller.reject);
router.delete('/:id', controller.remove);

module.exports = router;
