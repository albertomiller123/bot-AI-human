const db = require('../database/DatabaseManager');

class SocialGraph {
    constructor(config) {
        this.config = config || {};
        this.data = {}; // Cache
        this.initDB();
    }

    async initDB() {
        try {
            await db.run(`
                CREATE TABLE IF NOT EXISTS social_relationships (
                    username TEXT PRIMARY KEY,
                    role TEXT,
                    interactions INTEGER,
                    last_seen INTEGER
                )
            `);
            await this.load();
        } catch (err) {
            console.error('[SocialGraph] DB Init Error:', err);
        }
    }

    async load() {
        try {
            const rows = await db.all("SELECT * FROM social_relationships");
            rows.forEach(row => {
                this.data[row.username] = {
                    role: row.role,
                    interactions: row.interactions,
                    last_seen: row.last_seen
                };
            });
            console.log(`[SocialGraph] Loaded ${rows.length} relationships.`);
        } catch (e) {
            console.error("[SocialGraph] Load Error:", e);
        }
    }

    getRole(username) {
        // 1. Check Config for Owner/Trusted (Highest Priority)
        const owners = process.env.OWNER_LIST ? process.env.OWNER_LIST.split(',') : ['admin'];
        const trusted = process.env.TRUSTED_LIST ? process.env.TRUSTED_LIST.split(',') : [];

        if (owners.includes(username)) return 'owner';
        if (trusted.includes(username)) return 'trusted';

        // 2. Check Cache (synced with DB)
        if (this.data[username] && this.data[username].role) {
            return this.data[username].role;
        }

        // 3. Default
        return 'stranger';
    }

    updateInteraction(username, type) {
        if (!this.data[username]) {
            this.data[username] = { role: 'stranger', interactions: 0, last_seen: 0 };
        }

        this.data[username].interactions++;
        this.data[username].last_seen = Date.now();

        // Async Save (Upsert)
        db.run(`
            INSERT INTO social_relationships (username, role, interactions, last_seen)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
            interactions = excluded.interactions,
            last_seen = excluded.last_seen
        `, [
            username,
            this.data[username].role,
            this.data[username].interactions,
            this.data[username].last_seen
        ]).catch(e => console.error("[SocialGraph] Save Error:", e));
    }
}

module.exports = SocialGraph;
