const { mongoose } = require('../config/mongoose')

const adminActivitySchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, default: null },
  detail: { type: String, default: '' },
  performedBy: { type: String, default: 'system' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
})

const AdminActivity = mongoose.models.AdminActivity || mongoose.model('AdminActivity', adminActivitySchema)

async function logActivity(entry) {
  try {
    await AdminActivity.create(entry)
  } catch (error) {
    console.error('Failed to record admin activity:', error.message)
  }
}

async function listActivity(limit = 20) {
  return AdminActivity.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
}

async function clearActivity() {
  return AdminActivity.deleteMany({})
}

module.exports = {
  AdminActivity,
  logActivity,
  listActivity,
  clearActivity
}
