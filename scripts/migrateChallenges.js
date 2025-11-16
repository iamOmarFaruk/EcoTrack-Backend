require("dotenv").config();
const { mongoose, connectMongoose } = require("../src/config/mongoose");

/**
 * Migration script to convert challenges from old 'id' field to 'slug'
 * This script:
 * 1. Removes the old 'id' field
 * 2. Generates unique slugs from titles
 * 3. Updates participant status from 'joined' to 'active'
 */
async function migrateChallenges() {
  try {
    console.log("Starting challenge migration...");
    
    // Connect to database
    await connectMongoose();
    const collection = mongoose.connection.collection("challenges");

    const challenges = await collection.find({}).toArray();

    console.log(`Found ${challenges.length} challenges to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const challenge of challenges) {
      try {
        // Generate slug from title
        const baseSlug = challenge.title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");

        let slug = baseSlug;
        let counter = 1;

        // Check if slug exists
        while (true) {
          const existing = await collection.findOne({
            slug,
            _id: { $ne: challenge._id },
          });
          if (!existing) break;

          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Update participant status from 'joined' to 'active'
        const updatedParticipants = challenge.participants.map((p) => ({
          userId: p.userId,
          joinedAt: p.joinedAt,
          status: p.status === "joined" ? "active" : p.status,
        }));

        // Update challenge
        await collection.updateOne(
          { _id: challenge._id },
          {
            $set: {
              slug,
              participants: updatedParticipants,
            },
            $unset: { id: "" }, // Remove old 'id' field
          }
        );

        console.log(`✓ Migrated: "${challenge.title}" -> slug: "${slug}"`);
        successCount++;
      } catch (error) {
        console.error(`✗ Error migrating challenge "${challenge.title}":`, error.message);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("Migration completed!");
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log("=".repeat(50));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migrateChallenges();
