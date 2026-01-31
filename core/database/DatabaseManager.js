const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        if (DatabaseManager.instance) {
            return DatabaseManager.instance;
        }

        this.dbPath = path.join(process.cwd(), 'data', 'bot_memory.db');
        this.ensureDataDir();

        // Audit Fix #5: Auto-Backup on Startup
        this.backupDB();

        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('[DatabaseManager] Could not connect to database', err);
            } else {
                console.log('[DatabaseManager] Connected to SQLite database');
                this.initPragmas();
            }
        });

        DatabaseManager.instance = this;
    }

    backupDB() {
        if (!fs.existsSync(this.dbPath)) return;

        try {
            const backupDir = path.join(path.dirname(this.dbPath), 'backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `bot_memory_${timestamp}.db`);

            fs.copyFileSync(this.dbPath, backupPath);
            console.log(`[DatabaseManager] 💾 Backup created: ${path.basename(backupPath)}`);

            // Cleanup old backups (Keep last 5)
            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('bot_memory_') && f.endsWith('.db'))
                .sort(); // Oldest first

            while (files.length > 5) {
                const toDelete = files.shift();
                fs.unlinkSync(path.join(backupDir, toDelete));
                console.log(`[DatabaseManager] 🗑️ Removed old backup: ${toDelete}`);
            }
        } catch (e) {
            console.error("[DatabaseManager] Backup failed:", e.message);
        }
    }

    ensureDataDir() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    initPragmas() {
        this.db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging for concurrency
        this.db.run('PRAGMA synchronous = NORMAL');
        this.db.run('PRAGMA foreign_keys = ON');
    }

    /**
     * Run a query that returns no result (CREATE, INSERT, UPDATE, DELETE)
     * @param {string} sql 
     * @param {Array} params 
     * @returns {Promise<{lastID: number, changes: number}>}
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.error('[DatabaseManager] Error running sql ' + sql, JSON.stringify(err, Object.getOwnPropertyNames(err)));
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Run a query that returns a single row
     * @param {string} sql 
     * @param {Array} params 
     * @returns {Promise<any>}
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('[DatabaseManager] Error getting row ' + sql, JSON.stringify(err, Object.getOwnPropertyNames(err)));
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Run a query that returns multiple rows
     * @param {string} sql 
     * @param {Array} params 
     * @returns {Promise<Array<any>>}
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('[DatabaseManager] Error getting all rows ' + sql, err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Run a query that calls a callback for each row (Streaming)
     * @param {string} sql 
     * @param {Array} params 
     * @param {Function} callback (err, row) => void
     * @returns {Promise<number>} Number of rows processed
     */
    each(sql, params = [], callback) {
        return new Promise((resolve, reject) => {
            let count = 0;
            this.db.each(sql, params, (err, row) => {
                if (err) {
                    // For 'each', error logic is tricky if it happens mid-stream.
                    // Usually we want to stop or notify.
                    if (callback) callback(err, null);
                } else {
                    count++;
                    if (callback) callback(null, row);
                }
            }, (err, num) => {
                // Completion callback
                if (err) reject(err);
                else resolve(num);
            });
        });
    }

    /**
     * Execute a script (multiple statements)
     * @param {string} sql 
     * @returns {Promise<void>}
     */
    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) {
                    console.error('[DatabaseManager] Error execution script', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = new DatabaseManager();
