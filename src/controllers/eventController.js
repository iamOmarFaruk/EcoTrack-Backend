const eventModel = require('../models/eventModel');

const getAllEvents = async (req, res) => {
  try {
    const result = await eventModel.getAllEvents(req.query);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: { message: error.message }
    });
  }
};

const getEventById = async (req, res) => {
  try {
    const userId = req.user ? req.user.uid : null;
    const result = await eventModel.getEventById(req.params.id, userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: { message: error.message }
    });
  }
};

const createEvent = async (req, res) => {
  try {
    const event = await eventModel.createEvent(req.body, req.user.uid);
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: { message: error.message }
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const result = await eventModel.updateEvent(req.params.id, req.body, req.user.uid);
    
    if (result.error) {
      return res.status(result.code).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: { message: error.message }
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const result = await eventModel.deleteEvent(req.params.id, req.user.uid);
    
    if (result.error) {
      return res.status(result.code).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: { message: error.message }
    });
  }
};

const joinEvent = async (req, res) => {
  try {
    const result = await eventModel.joinEvent(req.params.id, req.user.uid);
    
    if (result.error) {
      return res.status(result.code).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully joined '${result.event.title}'`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to join event',
      error: { message: error.message }
    });
  }
};

const leaveEvent = async (req, res) => {
  try {
    const result = await eventModel.leaveEvent(req.params.id, req.user.uid);
    
    if (result.error) {
      return res.status(result.code).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully left '${result.event.title}'`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to leave event',
      error: { message: error.message }
    });
  }
};

const getMyEvents = async (req, res) => {
  try {
    const result = await eventModel.getMyEvents(req.user.uid);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your events',
      error: { message: error.message }
    });
  }
};

const getMyJoinedEvents = async (req, res) => {
  try {
    const statusFilter = req.query.status || 'upcoming';
    const result = await eventModel.getMyJoinedEvents(req.user.uid, statusFilter);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch joined events',
      error: { message: error.message }
    });
  }
};

const getEventParticipants = async (req, res) => {
  try {
    const userId = req.user ? req.user.uid : null;
    const result = await eventModel.getEventParticipants(req.params.id, userId);
    
    if (result.error) {
      return res.status(result.code).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participants',
      error: { message: error.message }
    });
  }
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  joinEvent,
  leaveEvent,
  getMyEvents,
  getMyJoinedEvents,
  getEventParticipants
};
