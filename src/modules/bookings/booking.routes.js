const express = require('express');
const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const service = require('./booking.service');

const controller = {
  list: catchAsync(async (req, res) => {
    const { rows, meta } = await service.listBookings(req.query);
    sendResponse(res, 200, 'Bookings fetched successfully', rows, meta);
  }),
  getOne: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Booking fetched successfully', await service.getBooking(req.params.id));
  }),
  create: catchAsync(async (req, res) => {
    sendResponse(res, 201, 'Booking created successfully', await service.createBooking(req.body));
  }),
  update: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Booking updated successfully', await service.updateBooking(req.params.id, req.body));
  }),
  complete: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Booking completed successfully', await service.completeBooking(req.params.id));
  }),
  reject: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Booking rejected', await service.rejectBooking(req.params.id));
  }),
  remove: catchAsync(async (req, res) => {
    await service.deleteBooking(req.params.id);
    sendResponse(res, 200, 'Booking deleted successfully', null);
  }),
};

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
