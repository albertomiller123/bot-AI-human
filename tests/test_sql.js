const db = require('../core/database/DatabaseManager');

async function test() {
    console.log("Testing SocialGraph SQL...");
    try {
        await db.run(`
            CREATE TABLE IF NOT EXISTS social_relationships (
                username TEXT PRIMARY KEY,
                role TEXT,
                interactions INTEGER,
                last_seen INTEGER
            )
        `);
        console.log("Table created.");

        // Try Insert
        await db.run(`
            INSERT INTO social_relationships (username, role, interactions, last_seen)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
            interactions = excluded.interactions,
            last_seen = excluded.last_seen
        `, ['test_user', 'stranger', 1, Date.now()]);
        console.log("Insert 1 success.");

        // Try Update
        await db.run(`
            INSERT INTO social_relationships (username, role, interactions, last_seen)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
            interactions = excluded.interactions,
            last_seen = excluded.last_seen
        `, ['test_user', 'friend', 2, Date.now()]);
        console.log("Update success.");

        const row = await db.get("SELECT * FROM social_relationships WHERE username = 'test_user'");
        console.log("Row:", row);

    } catch (e) {
        console.error("SQL Error:", e);
    }
}

test();
