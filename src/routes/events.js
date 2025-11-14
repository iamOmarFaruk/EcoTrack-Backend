const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateFirebaseToken, optionalFirebaseAuth } = require('../middleware/firebaseAuth');
const { validate, validateQuery, querySchemas } = require('../middleware/validation');

router.get(
  '/',
  validateQuery(querySchemas.eventFilters),
  eventController.getAllEvents
);

router.get(
  '/my-events',
  authenticateFirebaseToken,
  eventController.getMyEvents
);

router.get(
  '/my-joined',
  authenticateFirebaseToken,
  eventController.getMyJoinedEvents
);

router.get(
  '/:id',
  optionalFirebaseAuth,
  eventController.getEventById
);

router.post(
  '/',
  authenticateFirebaseToken,
  validate('createEvent'),
  eventController.createEvent
);

router.put(
  '/:id',
  authenticateFirebaseToken,
  validate('updateEvent'),
  eventController.updateEvent
);

router.delete(
  '/:id',
  authenticateFirebaseToken,
  eventController.deleteEvent
);

router.post(
  '/:id/join',
  authenticateFirebaseToken,
  eventController.joinEvent
);

router.post(
  '/:id/leave',
  authenticateFirebaseToken,
  eventController.leaveEvent
);

router.get(
  '/:id/participants',
  optionalFirebaseAuth,
  eventController.getEventParticipants
);

module.exports = router;
