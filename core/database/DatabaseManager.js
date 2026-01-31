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
