const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

/**
 * Events Routes
 * Base path: /api/events
 */

// GET /api/events/upcoming - Get upcoming events (place specific routes before parameterized ones)
router.get('/upcoming', eventController.getUpcomingEvents);

// GET /api/events - Get all events with filtering
router.get('/', eventController.getAllEvents);

// GET /api/events/:id - Get specific event
router.get('/:id', eventController.getEventById);

// POST /api/events - Create new event (auth required later)
router.post('/', eventController.createEvent);

// PATCH /api/events/:id - Update event (auth required later - organizer/admin only)
router.patch('/:id', eventController.updateEvent);

// DELETE /api/events/:id - Delete event (auth required later - organizer/admin only)
router.delete('/:id', eventController.deleteEvent);

// POST /api/events/:id/register - Register for event (auth required later)
router.post('/:id/register', eventController.registerForEvent);

// DELETE /api/events/:id/register - Unregister from event (auth required later)
router.delete('/:id/register', eventController.unregisterFromEvent);

// PATCH /api/events/:id/attendance - Mark attendance (auth required later - organizer/admin only)
router.patch('/:id/attendance', eventController.markAttendance);

// GET /api/events/:id/registrations - Get event registrations (auth required later - organizer/admin only)
router.get('/:id/registrations', eventController.getEventRegistrations);

module.exports = router;