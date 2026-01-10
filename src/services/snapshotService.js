const { mongoose } = require('../config/mongoose')
const { DemoSnapshot } = require('../models/demoSnapshotModel')
const demoConfig = require('../config/demoConfig')
const crypto = require('crypto')

/**
 * Snapshot Service
 *
 * Handles creating and restoring database snapshots for the demo reset feature.
 */
class SnapshotService {
  /**
   * Map collection names to Mongoose model names
   */
  getModelName(collectionName) {
    const mapping = {
      'challenges': 'Challenge',
      'events': 'Event',
      'tips': 'Tip',
      'sitecontents': 'SiteContent',
      'adminactivities': 'AdminActivity'
    }
    return mapping[collectionName] || collectionName
  }

  /**
   * Get a Mongoose model by collection name
   */
  getModel(collectionName) {
    const modelName = this.getModelName(collectionName)
    try {
      return mongoose.model(modelName)
    } catch (error) {
      console.warn(`Model ${modelName} not found for collection ${collectionName}`)
      return null
    }
  }

  /**
   * Take a snapshot of all resettable collections
   * @param {string} type - 'initial' or 'manual'
   * @param {string} createdBy - Who created the snapshot
   * @returns {Promise<Object>} The created snapshot
   */
  async createSnapshot(type = 'initial', createdBy = 'system') {
    const snapshotId = `snapshot-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`

    const data = {}
    const documentCounts = {}

    for (const collectionName of demoConfig.RESETTABLE_COLLECTIONS) {
      const Model = this.getModel(collectionName)

      if (!Model) {
        data[collectionName] = []
        documentCounts[collectionName] = 0
        continue
      }

      // Fetch all documents as plain objects
      const documents = await Model.find({}).lean()

      // Store documents (preserves MongoDB types when restored)
      data[collectionName] = documents
      documentCounts[collectionName] = documents.length
    }

    const snapshot = await DemoSnapshot.create({
      snapshotId,
      type,
      createdBy,
      data,
      documentCounts
    })

    console.log(`[Demo Reset] Created ${type} snapshot: ${snapshotId}`)
    console.log(`[Demo Reset] Document counts: ${JSON.stringify(documentCounts)}`)

    return snapshot
  }

  /**
   * Get the latest initial snapshot (used for reset)
   * @returns {Promise<Object|null>} The latest snapshot or null
   */
  async getLatestSnapshot() {
    return DemoSnapshot.findOne({ type: 'initial' })
      .sort({ createdAt: -1 })
      .lean()
  }

  /**
   * Restore database from a snapshot
   * @param {string|null} snapshotId - Specific snapshot ID or null for latest
   * @returns {Promise<Object>} Result of the restore operation
   */
  async restoreFromSnapshot(snapshotId = null) {
    // Get snapshot (latest if no ID provided)
    const snapshot = snapshotId
      ? await DemoSnapshot.findOne({ snapshotId }).lean()
      : await this.getLatestSnapshot()

    if (!snapshot) {
      throw new Error('No snapshot found to restore from')
    }

    console.log(`[Demo Reset] Restoring from snapshot: ${snapshot.snapshotId}`)

    const results = {}

    for (const collectionName of demoConfig.RESETTABLE_COLLECTIONS) {
      const Model = this.getModel(collectionName)

      if (!Model) {
        results[collectionName] = { skipped: true, reason: 'Model not found' }
        continue
      }

      const snapshotData = snapshot.data[collectionName] || []

      try {
        // Delete all existing documents
        const deleteResult = await Model.deleteMany({})

        // Insert snapshot data if any exists
        if (snapshotData.length > 0) {
          // Remove _id fields to avoid duplicate key errors if schema changed
          const cleanData = snapshotData.map(doc => {
            const { __v, ...rest } = doc

            // Fix missing category for events (schema evolution)
            if (collectionName === 'events' && !rest.category) {
              rest.category = 'Community'
            }

            return rest
          })

          await Model.insertMany(cleanData, { ordered: false })
        }

        results[collectionName] = {
          deleted: deleteResult.deletedCount,
          restored: snapshotData.length
        }

        console.log(`[Demo Reset] Restored ${collectionName}: ${snapshotData.length} documents`)
      } catch (error) {
        console.error(`[Demo Reset] Error restoring ${collectionName}:`, error.message)
        results[collectionName] = { error: error.message }
      }
    }

    console.log(`[Demo Reset] Restore completed from snapshot: ${snapshot.snapshotId}`)

    return {
      success: true,
      snapshotId: snapshot.snapshotId,
      restoredAt: new Date(),
      results
    }
  }

  /**
   * Check if initial snapshot exists, create if not
   * @returns {Promise<Object>} The existing or newly created snapshot
   */
  async ensureInitialSnapshot() {
    const existing = await DemoSnapshot.findOne({ type: 'initial' }).sort({ createdAt: -1 })

    if (!existing) {
      console.log('[Demo Reset] No initial snapshot found, creating one...')
      return this.createSnapshot('initial', 'system')
    }

    console.log(`[Demo Reset] Initial snapshot exists: ${existing.snapshotId}`)
    return existing
  }

  /**
   * Delete old snapshots, keeping only the most recent N
   * @param {number} keepCount - Number of snapshots to keep
   * @returns {Promise<number>} Number of deleted snapshots
   */
  async cleanupOldSnapshots(keepCount = 5) {
    const snapshots = await DemoSnapshot.find({})
      .sort({ createdAt: -1 })
      .skip(keepCount)
      .select('_id snapshotId')
      .lean()

    if (snapshots.length === 0) {
      return 0
    }

    const idsToDelete = snapshots.map(s => s._id)
    const result = await DemoSnapshot.deleteMany({ _id: { $in: idsToDelete } })

    console.log(`[Demo Reset] Cleaned up ${result.deletedCount} old snapshots`)
    return result.deletedCount
  }
}

module.exports = new SnapshotService()
