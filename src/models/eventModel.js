const database = require('../config/database');

const generateEventId = (title) => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  const timestamp = Date.now();
  return `${slug}-${timestamp}`;
};

const getDefaultImage = (title, location) => {
  const text = (title + ' ' + location).toLowerCase();
  
  if (text.includes('tree') || text.includes('plant') || text.includes('forest')) {
    return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1200&h=800&auto=format&fit=crop';
  }
  if (text.includes('recycle') || text.includes('electronic') || text.includes('waste')) {
    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1200&h=800&auto=format&fit=crop';
  }
  if (text.includes('garden') || text.includes('community')) {
    return 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200&h=800&auto=format&fit=crop';
  }
  if (text.includes('beach') || text.includes('ocean') || text.includes('cleanup')) {
    return 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?q=80&w=1200&h=800&auto=format&fit=crop';
  }
  
  return 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1200&h=800&auto=format&fit=crop';
};

const createEvent = async (eventData, userId) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const eventId = generateEventId(eventData.title);
  const now = new Date();
  
  const event = {
    id: eventId,
    title: eventData.title.trim(),
    description: eventData.description.trim(),
    detailedDescription: eventData.detailedDescription.trim(),
    date: new Date(eventData.date),
    location: eventData.location.trim(),
    organizer: eventData.organizer.trim(),
    capacity: parseInt(eventData.capacity),
    registeredParticipants: 0,
    duration: eventData.duration.trim(),
    requirements: eventData.requirements.trim(),
    benefits: eventData.benefits.trim(),
    image: eventData.image,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    participants: []
  };
  
  await eventsCollection.insertOne(event);
  return event;
};

const getAllEvents = async (filters = {}) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const page = parseInt(filters.page) || 1;
  const limit = Math.min(parseInt(filters.limit) || 10, 50);
  const skip = (page - 1) * limit;
  
  const query = {};
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  const sortField = filters.sortBy || 'date';
  const sortOrder = filters.order === 'desc' ? -1 : 1;
  const sort = { [sortField]: sortOrder };
  
  const events = await eventsCollection
    .find(query)
    .project({ participants: 0 })
    .skip(skip)
    .limit(limit)
    .sort(sort)
    .toArray();
  
  const total = await eventsCollection.countDocuments(query);
  
  return {
    events,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalEvents: total,
      eventsPerPage: limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  };
};

const getEventById = async (eventId, userId = null) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const event = await eventsCollection.findOne({ id: eventId });
  
  if (!event) {
    return null;
  }
  
  const result = {
    event,
    isJoined: null,
    isCreator: null,
    spotsRemaining: event.capacity - event.registeredParticipants,
    progressPercentage: Math.round((event.registeredParticipants / event.capacity) * 100)
  };
  
  if (userId) {
    result.isJoined = event.participants.some(
      p => p.userId === userId && p.status === 'joined'
    );
    result.isCreator = event.createdBy === userId;
  }
  
  return result;
};

const updateEvent = async (eventId, updateData, userId) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const event = await eventsCollection.findOne({ id: eventId });
  
  if (!event) {
    return { error: 'Event not found', code: 404 };
  }
  
  if (event.createdBy !== userId) {
    return { error: 'You are not authorized to update this event', code: 403 };
  }
  
  if (updateData.capacity !== undefined) {
    const newCapacity = parseInt(updateData.capacity);
    if (newCapacity < event.registeredParticipants) {
      return { 
        error: `Cannot reduce capacity below current participant count (${event.registeredParticipants})`, 
        code: 400 
      };
    }
  }
  
  if (updateData.date) {
    const newDate = new Date(updateData.date);
    if (newDate < new Date()) {
      return { error: 'Cannot change date to past', code: 400 };
    }
  }
  
  const updates = { updatedAt: new Date() };
  
  const allowedFields = [
    'title', 'description', 'detailedDescription', 'date', 'location',
    'organizer', 'capacity', 'duration', 'requirements', 'benefits', 'image', 'status'
  ];
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      if (typeof updateData[field] === 'string') {
        updates[field] = updateData[field].trim();
      } else if (field === 'date') {
        updates[field] = new Date(updateData[field]);
      } else {
        updates[field] = updateData[field];
      }
    }
  });
  
  await eventsCollection.updateOne(
    { id: eventId },
    { $set: updates }
  );
  
  const updatedEvent = await eventsCollection.findOne({ id: eventId });
  return { event: updatedEvent };
};

const deleteEvent = async (eventId, userId) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const event = await eventsCollection.findOne({ id: eventId });
  
  if (!event) {
    return { error: 'Event not found', code: 404 };
  }
  
  if (event.createdBy !== userId) {
    return { error: 'You are not authorized to delete this event', code: 403 };
  }
  
  if (event.registeredParticipants > 0) {
    await eventsCollection.updateOne(
      { id: eventId },
      { 
        $set: { 
          status: 'cancelled',
          updatedAt: new Date()
        }
      }
    );
    return { cancelled: true, message: 'Event marked as cancelled and participants notified' };
  }
  
  await eventsCollection.deleteOne({ id: eventId });
  return { deleted: true, message: 'Event deleted successfully' };
};

const joinEvent = async (eventId, userId) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const event = await eventsCollection.findOne({ id: eventId });
  
  if (!event) {
    return { error: 'Event not found', code: 404 };
  }
  
  if (event.createdBy === userId) {
    return { error: 'Event creators cannot join their own events', code: 400 };
  }
  
  if (event.status !== 'active') {
    return { error: 'Cannot join inactive events', code: 400 };
  }
  
  if (new Date(event.date) < new Date()) {
    return { error: 'Cannot join past events', code: 400 };
  }
  
  const alreadyJoined = event.participants.some(
    p => p.userId === userId && p.status === 'joined'
  );
  
  if (alreadyJoined) {
    return { error: 'You have already joined this event', code: 400 };
  }
  
  const result = await eventsCollection.updateOne(
    { 
      id: eventId,
      registeredParticipants: { $lt: event.capacity },
      status: 'active',
      'participants.userId': { $ne: userId }
    },
    { 
      $inc: { registeredParticipants: 1 },
      $push: { 
        participants: { 
          userId: userId,
          joinedAt: new Date(),
          status: 'joined'
        }
      },
      $set: { updatedAt: new Date() }
    }
  );
  
  if (result.modifiedCount === 0) {
    return { error: 'Event is full. No spots remaining.', code: 400 };
  }
  
  const updatedEvent = await eventsCollection.findOne({ id: eventId });
  
  return { 
    event: updatedEvent,
    participant: updatedEvent.participants.find(p => p.userId === userId),
    spotsRemaining: updatedEvent.capacity - updatedEvent.registeredParticipants
  };
};

const leaveEvent = async (eventId, userId) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const event = await eventsCollection.findOne({ id: eventId });
  
  if (!event) {
    return { error: 'Event not found', code: 404 };
  }
  
  const participant = event.participants.find(
    p => p.userId === userId && p.status === 'joined'
  );
  
  if (!participant) {
    return { error: 'You are not a participant of this event', code: 400 };
  }
  
  const result = await eventsCollection.updateOne(
    { 
      id: eventId,
      'participants': { 
        $elemMatch: { userId: userId, status: 'joined' } 
      }
    },
    { 
      $inc: { registeredParticipants: -1 },
      $set: { 
        'participants.$[elem].status': 'left',
        updatedAt: new Date()
      }
    },
    {
      arrayFilters: [{ 'elem.userId': userId, 'elem.status': 'joined' }]
    }
  );
  
  if (result.modifiedCount === 0) {
    return { error: 'Failed to leave event', code: 400 };
  }
  
  const updatedEvent = await eventsCollection.findOne({ id: eventId });
  
  return {
    event: updatedEvent,
    spotsRemaining: updatedEvent.capacity - updatedEvent.registeredParticipants
  };
};

const getMyEvents = async (userId) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const events = await eventsCollection
    .find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .toArray();
  
  const stats = {
    active: events.filter(e => e.status === 'active').length,
    completed: events.filter(e => e.status === 'completed').length,
    cancelled: events.filter(e => e.status === 'cancelled').length,
    totalParticipants: events.reduce((sum, e) => sum + e.registeredParticipants, 0)
  };
  
  return {
    events,
    total: events.length,
    stats
  };
};

const getMyJoinedEvents = async (userId, statusFilter = 'upcoming') => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const query = {
    'participants': { 
      $elemMatch: { userId: userId, status: 'joined' }
    }
  };
  
  if (statusFilter === 'upcoming') {
    query.date = { $gte: new Date() };
  } else if (statusFilter === 'past') {
    query.date = { $lt: new Date() };
  }
  
  const events = await eventsCollection
    .find(query)
    .sort({ date: 1 })
    .toArray();
  
  const allJoined = await eventsCollection
    .find({
      'participants': { 
        $elemMatch: { userId: userId, status: 'joined' }
      }
    })
    .toArray();
  
  const upcoming = allJoined.filter(e => new Date(e.date) >= new Date()).length;
  const past = allJoined.filter(e => new Date(e.date) < new Date()).length;
  
  return {
    events,
    total: events.length,
    upcoming,
    past
  };
};

const getEventParticipants = async (eventId, userId = null) => {
  const db = database.getDb();
  const eventsCollection = db.collection('events');
  
  const event = await eventsCollection.findOne({ id: eventId });
  
  if (!event) {
    return { error: 'Event not found', code: 404 };
  }
  
  const isCreator = userId && event.createdBy === userId;
  
  if (isCreator) {
    const joinedParticipants = event.participants.filter(p => p.status === 'joined');
    
    return {
      participants: joinedParticipants.map(p => ({
        userId: p.userId,
        joinedAt: p.joinedAt
      })),
      total: event.registeredParticipants,
      capacity: event.capacity
    };
  }
  
  return {
    total: event.registeredParticipants,
    capacity: event.capacity,
    spotsRemaining: event.capacity - event.registeredParticipants
  };
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  joinEvent,
  leaveEvent,
  getMyEvents,
  getMyJoinedEvents,
  getEventParticipants
};
