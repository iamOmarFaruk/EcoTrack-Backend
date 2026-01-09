const { getAdminConfig, verifyPassword, safeCompare } = require('../config/admin')
const { signAdminToken } = require('../middleware/adminAuth')
const { getSiteContent, updateSiteContent } = require('../models/siteContentModel')
const { logActivity, listActivity, clearActivity, deleteActivity } = require('../models/adminActivityModel')
const TipModel = require('../models/tipModel')
const { userDb } = require('../models/userModel')
const { mongoose } = require('../config/mongoose')

// Ensure models are registered
require('../models/challengeModel')
require('../models/eventModel')
require('../models/tipModel')
require('../models/userModel')

const Challenge = mongoose.model('Challenge')
const Event = mongoose.model('Event')
const Tip = mongoose.model('Tip')
const User = mongoose.model('User')

class AdminController {
  async login(req, res) {
    const { email, password } = req.body || {}
    const adminConfig = getAdminConfig()

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required' }
      })
    }

    const isEmailMatch = safeCompare(email.toLowerCase(), adminConfig.email.toLowerCase())
    const isPasswordValid = verifyPassword(password)

    if (!isEmailMatch || !isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid admin credentials' }
      })
    }

    const token = signAdminToken({
      email: adminConfig.email,
      name: adminConfig.name,
      role: 'admin'
    })

    await logActivity({
      action: 'login',
      entity: 'admin',
      entityId: adminConfig.email,
      detail: 'Admin logged in',
      performedBy: adminConfig.email
    })

    return res.json({
      success: true,
      data: {
        token,
        admin: {
          email: adminConfig.email,
          name: adminConfig.name
        },
        expiresInHours: adminConfig.tokenExpiryHours
      }
    })
  }

  async me(req, res) {
    return res.json({
      success: true,
      data: {
        admin: {
          email: req.admin.email,
          name: req.admin.name,
          role: req.admin.role || 'admin'
        }
      }
    })
  }

  async dashboard(req, res) {
    const [
      totalUsers,
      activeUsers,
      challengeActive,
      challengeDraft,
      challengeCompleted,
      eventsActive,
      eventsDraft,
      tipsPublished,
      tipsDraft
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Challenge.countDocuments({ status: 'active' }),
      Challenge.countDocuments({ status: 'draft' }),
      Challenge.countDocuments({ status: 'completed' }),
      Event.countDocuments({ status: 'active' }),
      Event.countDocuments({ status: 'draft' }),
      Tip.countDocuments({ $or: [{ status: 'published' }, { status: { $exists: false } }] }),
      Tip.countDocuments({ status: 'draft' })
    ])

    const recentActivity = await listActivity(8)
    const latestContent = await getSiteContent()

    const latestChallenges = await Challenge.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status featured registeredParticipants createdAt')
      .lean()

    const latestEvents = await Event.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status registeredParticipants capacity createdAt')
      .lean()

    return res.json({
      success: true,
      data: {
        stats: {
          users: totalUsers,
          activeUsers,
          challenges: challengeActive,
          events: eventsActive,
          tips: tipsPublished
        },
        breakdown: {
          challenges: { active: challengeActive, draft: challengeDraft, completed: challengeCompleted },
          events: { active: eventsActive, draft: eventsDraft },
          tips: { published: tipsPublished, draft: tipsDraft }
        },
        recentActivity,
        latestContentUpdatedAt: latestContent.updatedAt,
        latestChallenges,
        latestEvents
      }
    })
  }

  async getContent(req, res) {
    const content = await getSiteContent()
    return res.json({
      success: true,
      data: content
    })
  }

  async updateContent(req, res) {
    const content = await updateSiteContent(req.body, req.admin?.email || 'admin')

    await logActivity({
      action: 'update',
      entity: 'site-content',
      entityId: 'main',
      detail: 'Updated public site content',
      performedBy: req.admin?.email
    })

    return res.json({
      success: true,
      message: 'Content updated',
      data: content
    })
  }

  async listUsers(req, res) {
    const { page = 1, limit = 20, search = '' } = req.query
    const numericLimit = Math.min(parseInt(limit, 10) || 20, 100)
    const numericPage = parseInt(page, 10) || 1

    const query = {}
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ]
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ joinedAt: -1 })
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .select('displayName email photoURL role isActive stats joinedAt lastActive'),
      User.countDocuments(query)
    ])

    return res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          pages: Math.ceil(total / numericLimit)
        }
      }
    })
  }

  async updateUser(req, res) {
    const { id } = req.params
    const { role, isActive } = req.body || {}

    const existingUser = await User.findById(id).lean()
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      })
    }

    const update = {
      ...(role ? { role } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      updatedAt: new Date()
    }

    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()

    if (typeof isActive === 'boolean' && existingUser.isActive && !isActive) {
      await TipModel.removeUpvotesByUser(existingUser.firebaseUid)
    }

    await logActivity({
      action: 'update',
      entity: 'user',
      entityId: id,
      detail: `Updated user ${user.email}`,
      performedBy: req.admin?.email,
      metadata: { role, isActive }
    })

    return res.json({
      success: true,
      message: 'User updated',
      data: user
    })
  }

  async listChallenges(req, res) {
    const { status, search = '', limit = 25 } = req.query
    const numericLimit = Math.min(parseInt(limit, 10) || 25, 100)
    const query = {}
    if (status) query.status = status
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ]
    }

    const challenges = await Challenge.find(query)
      .sort({ createdAt: -1 })
      .limit(numericLimit)
      .select('title status featured registeredParticipants createdAt startDate endDate category createdBy')
      .lean()

    const creatorIds = challenges.map((challenge) => challenge.createdBy).filter(Boolean)
    const creatorMap = await userDb.getUserStatusMap(creatorIds)
    const challengesWithCreator = challenges.map((challenge) => {
      const creator = creatorMap.get(challenge.createdBy)
      return {
        ...challenge,
        creatorIsActive: creator ? creator.isActive : true,
        creatorName: creator?.displayName || null
      }
    })

    return res.json({
      success: true,
      data: challengesWithCreator
    })
  }

  async updateChallengeStatus(req, res) {
    const { id } = req.params
    const { status, featured } = req.body || {}

    const update = {
      ...(status ? { status } : {}),
      ...(typeof featured === 'boolean' ? { featured } : {}),
      updatedAt: new Date()
    }

    const challenge = await Challenge.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' }
      })
    }

    await logActivity({
      action: 'update',
      entity: 'challenge',
      entityId: id,
      detail: `Updated challenge "${challenge.title}"`,
      performedBy: req.admin?.email,
      metadata: { status, featured }
    })

    return res.json({
      success: true,
      message: 'Challenge updated',
      data: challenge
    })
  }

  async listEvents(req, res) {
    const { status, search = '', limit = 25 } = req.query
    const numericLimit = Math.min(parseInt(limit, 10) || 25, 100)
    const query = {}
    if (status) query.status = status
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ]
    }

    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .limit(numericLimit)
      .select('title status registeredParticipants capacity createdAt date location createdBy')
      .lean()

    const creatorIds = events.map((event) => event.createdBy).filter(Boolean)
    const creatorMap = await userDb.getUserStatusMap(creatorIds)
    const eventsWithCreator = events.map((event) => {
      const creator = creatorMap.get(event.createdBy)
      return {
        ...event,
        creatorIsActive: creator ? creator.isActive : true,
        creatorName: creator?.displayName || null
      }
    })

    return res.json({
      success: true,
      data: eventsWithCreator
    })
  }

  async updateEventStatus(req, res) {
    const { id } = req.params
    const { status } = req.body || {}

    const update = { updatedAt: new Date() }
    if (status) update.status = status

    const event = await Event.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean()

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { message: 'Event not found' }
      })
    }

    await logActivity({
      action: 'update',
      entity: 'event',
      entityId: id,
      detail: `Updated event "${event.title}"`,
      performedBy: req.admin?.email,
      metadata: { status }
    })

    return res.json({
      success: true,
      message: 'Event updated',
      data: event
    })
  }

  async getEvent(req, res) {
    const { id } = req.params

    const event = await Event.findById(id).lean()
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { message: 'Event not found' }
      })
    }

    return res.json({
      success: true,
      data: event
    })
  }

  async updateEvent(req, res) {
    const { id } = req.params
    const {
      title,
      description,
      detailedDescription,
      date,
      location,
      organizer,
      capacity,
      duration,
      requirements,
      benefits,
      image,
      category,
      status
    } = req.body || {}

    const existingEvent = await Event.findById(id).lean()
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        error: { message: 'Event not found' }
      })
    }

    const updateFields = { updatedAt: new Date() }
    if (title !== undefined) updateFields.title = title.trim()
    if (description !== undefined) updateFields.description = description.trim()
    if (detailedDescription !== undefined) updateFields.detailedDescription = detailedDescription.trim()
    if (date !== undefined) updateFields.date = new Date(date)
    if (location !== undefined) updateFields.location = location.trim()
    if (organizer !== undefined) updateFields.organizer = organizer.trim()
    if (capacity !== undefined) updateFields.capacity = parseInt(capacity, 10)
    if (duration !== undefined) updateFields.duration = duration.trim()
    if (requirements !== undefined) updateFields.requirements = requirements.trim()
    if (benefits !== undefined) updateFields.benefits = benefits.trim()
    if (image !== undefined) updateFields.image = image
    if (category !== undefined) updateFields.category = category
    if (status !== undefined) updateFields.status = status

    const event = await Event.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    ).lean()

    const changes = Object.keys(updateFields).filter(k => k !== 'updatedAt')
    await logActivity({
      action: 'update',
      entity: 'event',
      entityId: id,
      detail: `Updated event "${event.title}" (${changes.join(', ')})`,
      performedBy: req.admin?.email,
      metadata: { fields: changes }
    })

    return res.json({
      success: true,
      message: 'Event updated',
      data: event
    })
  }

  async deleteEvent(req, res) {
    const { id } = req.params

    const event = await Event.findById(id).lean()
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { message: 'Event not found' }
      })
    }

    await Event.findByIdAndDelete(id)

    await logActivity({
      action: 'delete',
      entity: 'event',
      entityId: id,
      detail: `Deleted event "${event.title}"`,
      performedBy: req.admin?.email,
      metadata: { title: event.title, status: event.status }
    })

    return res.json({
      success: true,
      message: 'Event deleted successfully'
    })
  }

  async listTips(req, res) {
    const { status, search = '', limit = 25 } = req.query
    const numericLimit = Math.min(parseInt(limit, 10) || 25, 100)
    const query = {}
    if (status) query.status = status
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ]
    }

    const tips = await Tip.find(query)
      .sort({ createdAt: -1 })
      .limit(numericLimit)
      .select('id title content status authorName upvoteCount createdAt category authorId')
      .lean()

    const authorIds = tips.map((tip) => tip.authorId).filter(Boolean)
    const authorMap = await userDb.getUserStatusMap(authorIds)
    const tipsWithAuthor = tips.map((tip) => {
      const author = authorMap.get(tip.authorId)
      return {
        ...tip,
        authorIsActive: author ? author.isActive : true,
        authorDisplayName: author?.displayName || null
      }
    })

    return res.json({
      success: true,
      data: tipsWithAuthor
    })
  }

  async updateTipStatus(req, res) {
    const { id } = req.params
    const { status, title, content, category } = req.body || {}

    const updateFields = { updatedAt: new Date() }
    if (status) updateFields.status = status
    if (title !== undefined) updateFields.title = title.trim()
    if (content !== undefined) updateFields.content = content.trim()
    if (category !== undefined) updateFields.category = category

    const tip = await Tip.findOneAndUpdate(
      { id },
      { $set: updateFields },
      { new: true }
    ).lean()

    if (!tip) {
      return res.status(404).json({
        success: false,
        error: { message: 'Tip not found' }
      })
    }

    const changes = []
    if (status) changes.push(`status: ${status}`)
    if (title) changes.push('title updated')
    if (content) changes.push('content updated')
    if (category) changes.push(`category: ${category}`)

    await logActivity({
      action: 'update',
      entity: 'tip',
      entityId: id,
      detail: `Updated tip "${tip.title}" (${changes.join(', ')})`,
      performedBy: req.admin?.email,
      metadata: { status, title: !!title, content: !!content, category }
    })

    return res.json({
      success: true,
      message: 'Tip updated',
      data: tip
    })
  }

  async activity(req, res) {
    const { limit = 30 } = req.query
    const activity = await listActivity(Math.min(parseInt(limit, 10) || 30, 100))
    return res.json({
      success: true,
      data: activity
    })
  }

  async clearActivity(req, res) {
    const result = await clearActivity()
    return res.json({
      success: true,
      message: 'Activity log cleared',
      data: {
        deletedCount: result?.deletedCount || 0
      }
    })
  }

  async deleteActivity(req, res) {
    const { id } = req.params
    const deleted = await deleteActivity(id)
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Activity not found' }
      })
    }
    return res.json({
      success: true,
      message: 'Activity deleted'
    })
  }
}

module.exports = new AdminController()
