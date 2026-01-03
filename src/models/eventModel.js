const { mongoose } = require('../config/mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'joined' }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  detailedDescription: { type: String, default: '' },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  organizer: { type: String, required: true },
  capacity: { type: Number, required: true },
  registeredParticipants: { type: Number, default: 0 },
  duration: { type: String, required: true },
  requirements: { type: String, default: '' },
  benefits: { type: String, default: '' },
  image: { type: String },
  category: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'active' },
  participants: { type: [participantSchema], default: [] }
});

eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ slug: 1 });
eventSchema.index({ title: 'text', description: 'text', detailedDescription: 'text', location: 'text' });

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

const generateEventSlug = async (title) => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists and append counter if needed
  while (await Event.findOne({ slug }).lean()) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
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
  const eventSlug = await generateEventSlug(eventData.title);
  const now = new Date();

  const event = new Event({
    slug: eventSlug,
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
    category: eventData.category,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    participants: []
  });

  await event.save();
  return event.toObject();
};

const getAllEvents = async (filters = {}) => {
  const page = parseInt(filters.page) || 1;
  const limit = Math.min(parseInt(filters.limit) || 10, 50);
  const skip = (page - 1) * limit;

  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category && filters.category !== 'All') {
    query.category = filters.category;
  }

  if (filters.availability === 'available') {
    query.$expr = { $lt: ['$registeredParticipants', '$capacity'] };
  }

  if (filters.dateRange === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    query.date = { $gte: today, $lt: tomorrow };
  } else if (filters.dateRange === 'this-week') {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    query.date = { $gte: today, $lt: nextWeek };
  }

  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  const sortField = filters.sortBy || 'date';
  const sortOrder = filters.order === 'desc' ? -1 : 1;
  const sort = { [sortField]: sortOrder };

  const events = await Event.find(query)
    .select('-participants')
    .skip(skip)
    .limit(limit)
    .sort(sort)
    .lean();

  const total = await Event.countDocuments(query);

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
  // Check if eventId is a valid MongoDB ObjectId or a slug
  const query = mongoose.Types.ObjectId.isValid(eventId) && eventId.length === 24
    ? { _id: eventId }
    : { slug: eventId };

  const event = await Event.findOne(query).lean();

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
  const event = await Event.findById(eventId).lean();

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
    'organizer', 'capacity', 'duration', 'requirements', 'benefits', 'image', 'status', 'category'
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

  const updatedEvent = await Event.findByIdAndUpdate(
    eventId,
    { $set: updates },
    { new: true }
  ).lean();

  return { event: updatedEvent };
};

const deleteEvent = async (eventId, userId) => {
  const event = await Event.findById(eventId).lean();

  if (!event) {
    return { error: 'Event not found', code: 404 };
  }

  if (event.createdBy !== userId) {
    return { error: 'You are not authorized to delete this event', code: 403 };
  }

  if (event.registeredParticipants > 0) {
    await Event.findByIdAndUpdate(
      eventId,
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
        },
      }
    );
    return { cancelled: true, message: 'Event marked as cancelled and participants notified' };
  }

  await Event.findByIdAndDelete(eventId);
  return { deleted: true, message: 'Event deleted successfully' };
};

const joinEvent = async (eventId, userId) => {
  const event = await Event.findById(eventId).lean();

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

  // Check if user previously left and allow them to rejoin
  const previouslyLeft = event.participants.find(
    p => p.userId === userId && p.status === 'left'
  );

  let result;

  if (previouslyLeft) {
    // User is rejoining - update their status
    result = await Event.updateOne(
      {
        _id: eventId,
        registeredParticipants: { $lt: event.capacity },
        status: 'active',
        participants: {
          $elemMatch: { userId: userId, status: 'left' }
        }
      },
      {
        $inc: { registeredParticipants: 1 },
        $set: {
          'participants.$[elem].status': 'joined',
          'participants.$[elem].joinedAt': new Date(),
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [{ 'elem.userId': userId, 'elem.status': 'left' }]
      }
    );
  } else {
    // New participant joining
    result = await Event.updateOne(
      {
        _id: eventId,
        registeredParticipants: { $lt: event.capacity },
        status: 'active',
        'participants.userId': { $ne: userId },
      },
      {
        $inc: { registeredParticipants: 1 },
        $push: {
          participants: {
            userId: userId,
            joinedAt: new Date(),
            status: 'joined',
          },
        },
        $set: { updatedAt: new Date() },
      }
    );
  }

  if (result.modifiedCount === 0) {
    return { error: 'Event is full. No spots remaining.', code: 400 };
  }

  const updatedEvent = await Event.findById(eventId).lean();

  return {
    event: updatedEvent,
    participant: updatedEvent.participants.find(p => p.userId === userId),
    spotsRemaining: updatedEvent.capacity - updatedEvent.registeredParticipants
  };
};

const leaveEvent = async (eventId, userId) => {
  const event = await Event.findById(eventId).lean();

  if (!event) {
    return { error: 'Event not found', code: 404 };
  }

  const participant = event.participants.find(
    p => p.userId === userId && p.status === 'joined'
  );

  if (!participant) {
    return { error: 'You are not a participant of this event', code: 400 };
  }

  const result = await Event.updateOne(
    {
      _id: eventId,
      participants: {
        $elemMatch: { userId: userId, status: 'joined' },
      },
    },
    {
      $inc: { registeredParticipants: -1 },
      $set: {
        'participants.$[elem].status': 'left',
        updatedAt: new Date(),
      },
    },
    {
      arrayFilters: [{ 'elem.userId': userId, 'elem.status': 'joined' }],
    }
  );

  if (result.modifiedCount === 0) {
    return { error: 'Failed to leave event', code: 400 };
  }

  const updatedEvent = await Event.findById(eventId).lean();

  return {
    event: updatedEvent,
    spotsRemaining: updatedEvent.capacity - updatedEvent.registeredParticipants
  };
};

const getMyEvents = async (userId) => {
  const events = await Event.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .lean();

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

  const events = await Event.find(query)
    .sort({ date: 1 })
    .lean();

  // Get counts of all joined events (both upcoming and past) for stats
  const allJoined = await Event.find({
    participants: {
      $elemMatch: { userId: userId, status: 'joined' }
    }
  })
    .select('date')
    .lean();

  const now = new Date();
  const upcoming = allJoined.filter(e => new Date(e.date) >= now).length;
  const past = allJoined.filter(e => new Date(e.date) < now).length;

  return {
    events,
    total: events.length,
    upcoming,
    past
  };
};

const getEventParticipants = async (eventId, userId = null) => {
  const event = await Event.findById(eventId).lean();

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
