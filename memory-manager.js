const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MemoryManager {
    constructor(baseDir) {
        this.dbPath = path.join(baseDir, 'memory.db');
        this.db = null;
    }

    // --- SQLite Retry Wrappers ---
    async _runWithRetry(sql, params = []) {
        return this._executeWithRetry('run', sql, params);
    }

    async _getWithRetry(sql, params = []) {
        return this._executeWithRetry('get', sql, params);
    }

    async _allWithRetry(sql, params = []) {
        return this._executeWithRetry('all', sql, params);
    }

    async _executeWithRetry(method, sql, params, retries = 5, delay = 50) {
        return new Promise((resolve, reject) => {
            const attempt = (n) => {
                this.db[method](sql, params, function (err, rowOrRows) { // Use function to get 'this' usually, but here checking err
                    if (err) {
                        if (err.code === 'SQLITE_BUSY' && n > 0) {
                            console.warn(`[MemoryManager] SQLITE_BUSY. Retrying in ${delay}ms... (${n} left)`);
                            setTimeout(() => attempt(n - 1), delay * 2); // Exponential backoff
                            return;
                        }
                        return reject(err);
                    }
                    resolve(rowOrRows || (method === 'run' ? this : null)); // 'this' in run callback has changes/lastID
                });
            };
            attempt(retries);
        });
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
        const row = await this._getWithRetry("SELECT value FROM long_term WHERE key = ?", [key]);
        return row ? JSON.parse(row.value) : null;
    }

    async setLTM(key, value) {
        const val = JSON.stringify(value);
        await this._runWithRetry("INSERT OR REPLACE INTO long_term (key, value) VALUES (?, ?)", [key, val]);
    }

    async logChat(username, message) {
        await this._runWithRetry("INSERT INTO chat_logs (username, message) VALUES (?, ?)", [username, message]);
    }

    // Legacy method (kept for backward compatibility)
    async saveChest(pos, items) {
        // Sync with Normalized Table
        try {
            await this.saveChestItems(pos, items);
        } catch (e) {
            console.error("[MemoryManager] Warning: Failed to sync chest_items:", e.message);
        }

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
        const rows = await this._allWithRetry(
            "SELECT chest_pos, x, y, z, count, slot FROM chest_items WHERE item_name = ?",
            [itemName]
        );
        return rows || [];
    }

    // --- NEW: Normalized SQL Methods (Phase 3+ Completion) ---

    async saveLocation(name, pos) {
        await this._runWithRetry("INSERT OR REPLACE INTO locations (name, x, y, z) VALUES (?, ?, ?, ?)",
            [name, pos.x, pos.y, pos.z]);
    }

    async getLocation(name) {
        return await this._getWithRetry("SELECT * FROM locations WHERE name = ?", [name]);
    }

    async getAllLocations() {
        const rows = await this._allWithRetry("SELECT * FROM locations");
        // Convert array of rows to object map to match old LTM format expectations if needed
        const locs = {};
        rows.forEach(r => locs[r.name] = { x: r.x, y: r.y, z: r.z });
        return locs;
    }

    async logAction(action, params) {
        const paramsJson = JSON.stringify(params);
        await this._runWithRetry("INSERT INTO action_history (action, params) VALUES (?, ?)",
            [action, paramsJson]);
    }

    async getRecentActions(limit = 10) {
        const rows = await this._allWithRetry("SELECT * FROM action_history ORDER BY id DESC LIMIT ?", [limit]);
        return rows.map(r => ({
            action: r.action,
            params: JSON.parse(r.params),
            timestamp: r.timestamp
        }));
    }

    async getRecentChats(limit = 20) {
        return await this._allWithRetry("SELECT * FROM chat_logs ORDER BY id DESC LIMIT ?", [limit]);
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
