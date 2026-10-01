const express = require('express');
const controller = require('./sale.controller');
// const { protect, checkPermission } = require('../../middlewares/rbac'); // attach when RBAC is wired in

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });
router.post('/from-booking/:id', ...require('../../middleware/protect-resource')('SALES'), require('../../utils/async-handler')(async (req, res) => {
  const invoice = await require('./sale.service').convertBooking(require('../../utils/validation').id(req.params.id, 'booking_id'));
  require('../../utils/send-response')(res, 200, 'Booking converted to invoice', invoice);
}));

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('SALES'));

router.get("/next-receipt", controller.getNextReceipt);
router.get('/summary', controller.getSummary);   // ← moved above '/:id'

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
