const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MemoryManager {
    constructor(baseDir) {
        this.dbPath = path.join(baseDir, 'memory.db');
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) return reject(err);

                this.db.serialize(() => {
                    this.db.run(`CREATE TABLE IF NOT EXISTS long_term (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )`);

                    this.db.run(`CREATE TABLE IF NOT EXISTS chat_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT,
                        message TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    this.db.run(`CREATE TABLE IF NOT EXISTS locations (
                        name TEXT PRIMARY KEY,
                        x REAL, y REAL, z REAL
                    )`);

                    // Legacy table (kept for backward compatibility)
                    this.db.run(`CREATE TABLE IF NOT EXISTS chest_contents (
                        pos_key TEXT PRIMARY KEY,
                        x INTEGER, y INTEGER, z INTEGER,
                        items TEXT,
                        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    this.db.run(`CREATE TABLE IF NOT EXISTS action_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        action TEXT,
                        params TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    // NEW: Normalized chest_items table for O(1) queries
                    this.db.run(`CREATE TABLE IF NOT EXISTS chest_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        chest_pos TEXT NOT NULL,
                        x INTEGER, y INTEGER, z INTEGER,
                        item_name TEXT NOT NULL,
                        count INTEGER DEFAULT 1,
                        slot INTEGER,
                        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    // Create indexes for efficient lookups
                    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chest_items_name ON chest_items(item_name)`);
                    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chest_items_pos ON chest_items(chest_pos)`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
    }

    async getLTM(key) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT value FROM long_term WHERE key = ?", [key], (err, row) => {
                if (err) return reject(err);
                resolve(row ? JSON.parse(row.value) : null);
            });
        });
    }

    async setLTM(key, value) {
        const val = JSON.stringify(value);
        return new Promise((resolve, reject) => {
            this.db.run("INSERT OR REPLACE INTO long_term (key, value) VALUES (?, ?)", [key, val], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async logChat(username, message) {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO chat_logs (username, message) VALUES (?, ?)", [username, message], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    // Legacy method (kept for backward compatibility)
    async saveChest(pos, items) {
        const posKey = `${pos.x},${pos.y},${pos.z}`;
        const itemsJson = JSON.stringify(items);
        return new Promise((resolve, reject) => {
            this.db.run("INSERT OR REPLACE INTO chest_contents (pos_key, x, y, z, items) VALUES (?, ?, ?, ?, ?)",
                [posKey, pos.x, pos.y, pos.z, itemsJson], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
        });
    }

    // NEW: Normalized chest saving for O(1) item lookups
    async saveChestItems(pos, items) {
        const posKey = `${pos.x},${pos.y},${pos.z}`;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Clear old items for this chest position
                this.db.run("DELETE FROM chest_items WHERE chest_pos = ?", [posKey]);

                // Insert each item as a separate row
                const stmt = this.db.prepare(
                    "INSERT INTO chest_items (chest_pos, x, y, z, item_name, count, slot) VALUES (?, ?, ?, ?, ?, ?, ?)"
                );

                for (const item of items) {
                    stmt.run([posKey, pos.x, pos.y, pos.z, item.name, item.count, item.slot]);
                }

                stmt.finalize((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }

    // NEW: Efficient O(1) indexed item search
    async findItemInChests(itemName) {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT chest_pos, x, y, z, count, slot FROM chest_items WHERE item_name = ?",
                [itemName],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    // --- NEW: Normalized SQL Methods (Phase 3+ Completion) ---

    async saveLocation(name, pos) {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT OR REPLACE INTO locations (name, x, y, z) VALUES (?, ?, ?, ?)",
                [name, pos.x, pos.y, pos.z], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
        });
    }

    async getLocation(name) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM locations WHERE name = ?", [name], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    async getAllLocations() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM locations", (err, rows) => {
                if (err) return reject(err);
                // Convert array of rows to object map to match old LTM format expectations if needed
                const locs = {};
                rows.forEach(r => locs[r.name] = { x: r.x, y: r.y, z: r.z });
                resolve(locs);
            });
        });
    }

    async logAction(action, params) {
        const paramsJson = JSON.stringify(params);
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO action_history (action, params) VALUES (?, ?)",
                [action, paramsJson], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
        });
    }

    async getRecentActions(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM action_history ORDER BY id DESC LIMIT ?", [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => ({
                    action: r.action,
                    params: JSON.parse(r.params),
                    timestamp: r.timestamp
                })));
            });
        });
    }

    async getRecentChats(limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM chat_logs ORDER BY id DESC LIMIT ?", [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // Backup compatibility for bot-core
    get(fileName) {
        // Note: Generic JSON getting is harder with SQLite mapping.
        // We will need to update bot-core to use explicit methods.
        return {};
    }

    markDirty() { } // No longer needed as SQLite saves immediately
    async forceSave() { } // No longer needed
    async initFile() { } // No longer needed
}

module.exports = MemoryManager;
