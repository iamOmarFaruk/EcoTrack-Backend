require("dotenv").config();
const database = require("../src/config/database");

async function initChallengeIndexes() {
  try {
    console.log("Connecting to MongoDB...");
    await database.connect();
    const db = database.getDb();
    const collection = db.collection("challenges");

    console.log("Creating indexes for challenges collection...");

    // Create all required indexes
    await collection.createIndex({ id: 1 }, { unique: true });
    console.log("✓ Created unique index on 'id'");

    await collection.createIndex({ createdBy: 1 });
    console.log("✓ Created index on 'createdBy'");

    await collection.createIndex({ startDate: 1 });
    console.log("✓ Created index on 'startDate'");

    await collection.createIndex({ endDate: 1 });
    console.log("✓ Created index on 'endDate'");

    await collection.createIndex({ status: 1 });
    console.log("✓ Created index on 'status'");

    await collection.createIndex({ category: 1 });
    console.log("✓ Created index on 'category'");

    await collection.createIndex({ featured: 1 });
    console.log("✓ Created index on 'featured'");

    // Compound indexes
    await collection.createIndex({ status: 1, startDate: 1 });
    console.log("✓ Created compound index on 'status' and 'startDate'");

    await collection.createIndex({ status: 1, featured: -1 });
    console.log("✓ Created compound index on 'status' and 'featured'");

    await collection.createIndex({ "participants.userId": 1 });
    console.log("✓ Created index on 'participants.userId'");

    // Text index for search
    await collection.createIndex(
      {
        title: "text",
        shortDescription: "text",
        category: "text",
      },
      {
        weights: {
          title: 10,
          category: 5,
          shortDescription: 1,
        },
        name: "challenge_text_search",
      }
    );
    console.log("✓ Created text search index on 'title', 'shortDescription', and 'category'");

    console.log("\n✅ All challenge indexes created successfully!");

    // List all indexes
    const indexes = await collection.indexes();
    console.log("\nCurrent indexes:");
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key));
    });

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    await database.disconnect();
    process.exit(1);
  }
}

// Run the initialization
initChallengeIndexes();
