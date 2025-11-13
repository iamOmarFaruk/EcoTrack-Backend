const { eventDb } = require('../models/eventModel');

/**
 * Events Controller
 * Handles all event-related operations
 */
class EventController {

  /**
   * Get all events with filtering and pagination
   * GET /api/events
   */
  async getAllEvents(req, res, next) {
    try {
      const {
        status, // upcoming, completed, cancelled
        location,
        date,
        category,
        page = 1,
        limit = 20
      } = req.query;

      // Apply filters
      const events = await eventDb.findAll({
        status,
        location,
        date,
        category
      });

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedEvents = events.slice(startIndex, endIndex);

      // Add calculated fields
      const enhancedEvents = paginatedEvents.map(event => ({
        ...event,
        spotsRemaining: event.maxParticipants - event.currentParticipants,
        isFull: event.currentParticipants >= event.maxParticipants,
        isUpcoming: new Date(event.date) > new Date(),
        registrationCount: event.registrations?.length || 0
      }));

      // Prepare pagination info
      const totalEvents = events.length;
      const totalPages = Math.ceil(totalEvents / parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          events: enhancedEvents
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalEvents,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single event by ID
   * GET /api/events/:id
   */
  async getEventById(req, res, next) {
    try {
      const { id } = req.params;

      const event = eventMockDb.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Event not found',
            code: 'EVENT_NOT_FOUND'
          }
        });
      }

      // Add calculated fields
      const enhancedEvent = {
        ...event,
        spotsRemaining: event.maxParticipants - event.currentParticipants,
        isFull: event.currentParticipants >= event.maxParticipants,
        isUpcoming: new Date(event.date) > new Date(),
        registrationCount: event.registrations?.length || 0,
        duration: calculateEventDuration(event.date, event.endDate)
      };

      res.status(200).json({
        success: true,
        data: { event: enhancedEvent }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new event
   * POST /api/events
   */
  async createEvent(req, res, next) {
    try {
      const {
        title,
        description,
        detailedDescription,
        date,
        endDate,
        location,
        maxParticipants,
        organizerName,
        category,
        requirements,
        benefits,
        imageUrl
      } = req.body;

      // Basic validation
      if (!title || !description || !date || !location || !maxParticipants) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Required fields: title, description, date, location, maxParticipants',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      // Validate date is in the future
      const eventDate = new Date(date);
      if (eventDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Event date must be in the future',
            code: 'INVALID_DATE'
          }
        });
      }

      // Validate location structure
      if (typeof location !== 'object' || !location.address || !location.city) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Location must include address and city',
            code: 'INVALID_LOCATION'
          }
        });
      }

      const eventData = {
        title,
        description,
        detailedDescription,
        date,
        endDate,
        location,
        maxParticipants: parseInt(maxParticipants),
        organizer: req.user?.email || 'mock@example.com', // Will use auth later
        organizerName: organizerName || req.user?.displayName || 'Mock Organizer',
        category: category || 'Community',
        requirements,
        benefits,
        imageUrl
      };

      const newEvent = await eventDb.create(eventData);

      res.status(201).json({
        success: true,
        data: { event: newEvent },
        message: 'Event created successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update event
   * PATCH /api/events/:id
   */
  async updateEvent(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated
      delete updateData._id;
      delete updateData.organizer;
      delete updateData.currentParticipants;
      delete updateData.registrations;
      delete updateData.createdAt;

      const updatedEvent = await eventDb.update(id, updateData);

      if (!updatedEvent) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Event not found',
            code: 'EVENT_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: { event: updatedEvent },
        message: 'Event updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete event
   * DELETE /api/events/:id
   */
  async deleteEvent(req, res, next) {
    try {
      const { id } = req.params;

      const deleted = await eventDb.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Event not found',
            code: 'EVENT_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Event deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Register for an event
   * POST /api/events/:id/register
   */
  async registerForEvent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.uid || 'mock_user_123'; // Will use auth later

      try {
        const updatedEvent = await eventDb.register(id, userId);

        res.status(200).json({
          success: true,
          data: {
            eventId: id,
            userId,
            registeredAt: new Date().toISOString(),
            spotsRemaining: updatedEvent.maxParticipants - updatedEvent.currentParticipants
          },
          message: 'Successfully registered for event'
        });

      } catch (registrationError) {
        return res.status(400).json({
          success: false,
          error: {
            message: registrationError.message,
            code: 'REGISTRATION_ERROR'
          }
        });
      }

    } catch (error) {
      next(error);
    }
  }

  /**
   * Unregister from an event
   * DELETE /api/events/:id/register
   */
  async unregisterFromEvent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.uid || 'mock_user_123'; // Will use auth later

      try {
        const updatedEvent = await eventDb.unregister(id, userId);

        res.status(200).json({
          success: true,
          data: {
            eventId: id,
            userId,
            spotsRemaining: updatedEvent.maxParticipants - updatedEvent.currentParticipants
          },
          message: 'Successfully unregistered from event'
        });

      } catch (unregistrationError) {
        return res.status(400).json({
          success: false,
          error: {
            message: unregistrationError.message,
            code: 'UNREGISTRATION_ERROR'
          }
        });
      }

    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark attendance for an event (organizers only)
   * PATCH /api/events/:id/attendance
   */
  async markAttendance(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, attended } = req.body;

      if (!userId || typeof attended !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Required fields: userId (string), attended (boolean)',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      try {
        const updatedEvent = eventMockDb.markAttendance(id, userId, attended);

        res.status(200).json({
          success: true,
          data: {
            eventId: id,
            userId,
            attended,
            markedAt: new Date().toISOString()
          },
          message: `Attendance marked as ${attended ? 'attended' : 'not attended'}`
        });

      } catch (attendanceError) {
        return res.status(400).json({
          success: false,
          error: {
            message: attendanceError.message,
            code: 'ATTENDANCE_ERROR'
          }
        });
      }

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming events
   * GET /api/events/upcoming
   */
  async getUpcomingEvents(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const upcomingEvents = await eventDb.findAll({ status: 'upcoming' })
        .slice(0, parseInt(limit))
        .map(event => ({
          ...event,
          spotsRemaining: event.maxParticipants - event.currentParticipants,
          isFull: event.currentParticipants >= event.maxParticipants,
          daysUntilEvent: Math.ceil((new Date(event.date) - new Date()) / (1000 * 60 * 60 * 24))
        }));

      res.status(200).json({
        success: true,
        data: { events: upcomingEvents },
        message: `Next ${limit} upcoming events`
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get event registrations (organizers only)
   * GET /api/events/:id/registrations
   */
  async getEventRegistrations(req, res, next) {
    try {
      const { id } = req.params;

      const event = eventMockDb.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Event not found',
            code: 'EVENT_NOT_FOUND'
          }
        });
      }

      // Mock enhanced registrations data
      const enhancedRegistrations = event.registrations.map(reg => ({
        ...reg,
        userName: 'Mock User', // Would fetch from users collection
        userEmail: 'mockuser@example.com',
        userPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      }));

      res.status(200).json({
        success: true,
        data: {
          eventId: id,
          eventTitle: event.title,
          registrations: enhancedRegistrations,
          totalRegistrations: event.registrations.length,
          attendanceCount: event.registrations.filter(r => r.attended === true).length
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

// Helper function to calculate event duration
function calculateEventDuration(startDate, endDate) {
  if (!endDate) return null;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end - start;
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes, totalMinutes: Math.floor(durationMs / (1000 * 60)) };
}

module.exports = new EventController();