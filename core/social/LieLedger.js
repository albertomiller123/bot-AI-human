const db = require('../database/DatabaseManager');

class LieLedger {
    constructor() {
        this.data = {}; // Cache: username -> { facts_told: [] }
        this.initDB();
    }

    async initDB() {
        try {
            await db.run(`
                CREATE TABLE IF NOT EXISTS lie_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    fact_text TEXT,
                    timestamp INTEGER
                )
            `);
            await this.load();
        } catch (err) {
            console.error('[LieLedger] DB Init Error:', err);
        }
    }

    async load() {
        try {
            const rows = await db.all("SELECT * FROM lie_ledger ORDER BY timestamp ASC");
            rows.forEach(row => {
                if (!this.data[row.username]) {
                    this.data[row.username] = { facts_told: [] };
                }
                this.data[row.username].facts_told.push({
                    text: row.fact_text,
                    timestamp: row.timestamp
                });
            });
            console.log(`[LieLedger] Loaded ${rows.length} facts.`);
        } catch (e) {
            console.error("[LieLedger] Load Error:", e);
        }
    }

    getFacts(username) {
        if (!this.data[username]) return [];
        return this.data[username].facts_told || [];
    }

    addFact(username, fact) {
        if (!this.data[username]) {
            this.data[username] = { facts_told: [] };
        }

        const timestamp = Date.now();
        this.data[username].facts_told.push({
            text: fact,
            timestamp: timestamp
        });

        // Async Save
        db.run(
            `INSERT INTO lie_ledger (username, fact_text, timestamp) VALUES (?, ?, ?)`,
            [username, fact, timestamp]
        ).catch(e => console.error("[LieLedger] Save Error:", e));
    }

    /**
     * Check if a new statement contradicts previous lies
     */
    checkConsistency(username, newStatement) {
        const facts = this.getFacts(username);
        // MVP: Just return the facts for the AI to check in the prompt
        return facts.map(f => f.text);
    }
}

module.exports = LieLedger;
