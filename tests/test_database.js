const db = require('../core/database/DatabaseManager');
const VectorDB = require('../core/memory/VectorDB');
const SocialGraph = require('../core/social/SocialGraph');
const LieLedger = require('../core/social/LieLedger');

async function test() {
    console.log("=== STARTING DATABASE MIGRATION TEST ===");

    // Cleanup
    const fs = require('fs');
    try {
        await db.run("DROP TABLE IF EXISTS social_relationships");
        await db.run("DROP TABLE IF EXISTS lie_ledger");
        await db.run("DROP TABLE IF EXISTS vectors");
        console.log("Cleaned up old tables.");
    } catch (e) { }

    // 1. Test SocialGraph
    console.log("\n--- Testing SocialGraph ---");
    const social = new SocialGraph();
    console.log("Waiting for SocialGraph init (3s)...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Updating interaction for 'test_user'...");
    social.updateInteraction('test_user', 'chat');
    await new Promise(r => setTimeout(r, 1000)); // Wait for async DB write

    // Check Cache
    const role = social.getRole('test_user');
    console.log(`Cache Role: ${role} (Expected: stranger)`);

    // Check DB
    const socialRow = await db.get("SELECT * FROM social_relationships WHERE username = ?", ['test_user']);
    console.log("DB Row:", socialRow);
    if (!socialRow || socialRow.interactions !== 1) throw new Error("SocialGraph persistence failed!");


    // 2. Test LieLedger
    console.log("\n--- Testing LieLedger ---");
    const ledger = new LieLedger();
    await new Promise(r => setTimeout(r, 500));

    console.log("Adding fact for 'liar_dave'...");
    ledger.addFact('liar_dave', 'The sky is green');
    await new Promise(r => setTimeout(r, 1000)); // Wait for async DB write

    // Check Cache
    const facts = ledger.getFacts('liar_dave');
    console.log("Cache Facts:", facts);

    // Check DB
    const factRow = await db.get("SELECT * FROM lie_ledger WHERE username = ?", ['liar_dave']);
    console.log("DB Row:", factRow);
    if (!factRow || factRow.fact_text !== 'The sky is green') throw new Error("LieLedger persistence failed!");


    // 3. Test VectorDB
    console.log("\n--- Testing VectorDB ---");
    // Mock botCore for VectorDB
    const vectorDB = new VectorDB({});

    // Mock createEmbedding to avoid loading full model
    vectorDB.createEmbedding = async (text) => {
        return [0.1, 0.2, 0.3]; // Fake vector
    };

    console.log("Adding memory...");
    await vectorDB.add("Hello World", { type: "test" });
    await new Promise(r => setTimeout(r, 1000)); // Wait for async DB write

    // Check Cache
    console.log("Cache size:", vectorDB.vectors.length);

    // Check DB
    const vectorRow = await db.get("SELECT * FROM vectors WHERE content = ?", ['Hello World']);
    console.log("DB Row:", vectorRow);

    if (!vectorRow) throw new Error("VectorDB persistence failed!");

    const embedding = JSON.parse(vectorRow.embedding);
    if (embedding.length !== 3) throw new Error("VectorDB embedding corrupted!");

    console.log("\n=== ALL TESTS PASSED ===");
    process.exit(0);
}

test().catch(err => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
});
