const { mongoose } = require('../config/mongoose')

/**
 * Demo Snapshot Schema
 *
 * Stores complete snapshots of resettable collections for the demo reset feature.
 * Snapshots are used as restore points when demo data needs to be reset.
 */
const demoSnapshotSchema = new mongoose.Schema({
  // Unique identifier for this snapshot
  snapshotId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // When the snapshot was taken
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Who created the snapshot
  createdBy: {
    type: String,
    default: 'system'
  },

  // Snapshot type: 'initial' (baseline) or 'manual' (user-created)
  type: {
    type: String,
    enum: ['initial', 'manual'],
    default: 'initial'
  },

  // The actual data snapshots per collection
  // Using Mixed type to store any document structure
  data: {
    challenges: [{ type: mongoose.Schema.Types.Mixed }],
    events: [{ type: mongoose.Schema.Types.Mixed }],
    tips: [{ type: mongoose.Schema.Types.Mixed }],
    sitecontents: [{ type: mongoose.Schema.Types.Mixed }],
    adminactivities: [{ type: mongoose.Schema.Types.Mixed }]
  },

  // Document counts for quick reference
  documentCounts: {
    challenges: { type: Number, default: 0 },
    events: { type: Number, default: 0 },
    tips: { type: Number, default: 0 },
    sitecontents: { type: Number, default: 0 },
    adminactivities: { type: Number, default: 0 }
  }
})

// Index for efficient queries
demoSnapshotSchema.index({ type: 1, createdAt: -1 })

const DemoSnapshot = mongoose.model('DemoSnapshot', demoSnapshotSchema)

module.exports = { DemoSnapshot }
