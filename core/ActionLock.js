/**
 * ActionLock.js
 * Manages concurrency control to prevent Action Race Conditions.
 * Ensures Reflex (Fast) and Strategy (Slow) don't fight over bot controls.
 */

class ActionLock {
    constructor() {
        this.lockedBy = null; // 'reflex' | 'strategy' | 'user' | null
        this.priority = 0;    // 0=idle, 1=strategy, 2=reflex, 3=user/guardian
        this.timestamp = 0;
        this.timeout = null;
    }

    /**
     * Try to acquire lock for a specific source
     * level: 1 (Strategy), 2 (Reflex), 3 (User/Critical)
     */
    tryAcquire(source, level, durationMs = 5000) {
        // Higher or equal priority can override LOWER priority
        // Same priority cannot override unless it's the same source (refresh)

        if (this.lockedBy && level < this.priority) {
            console.log(`[ActionLock] 🔒 Denied lock for ${source} (Current: ${this.lockedBy}, L${this.priority})`);
            return false;
        }

        if (this.lockedBy && level === this.priority && this.lockedBy !== source) {
            console.log(`[ActionLock] 🔒 Denied lock for ${source} (Conflict with ${this.lockedBy})`);
            return false;
        }

        // Grant Lock
        this._setLock(source, level, durationMs);
        return true;
    }

    _setLock(source, level, durationMs) {
        if (this.timeout) clearTimeout(this.timeout);

        this.lockedBy = source;
        this.priority = level;
        this.timestamp = Date.now();

        console.log(`[ActionLock] 🔓 Lock acquired by ${source} (L${level}) for ${durationMs}ms`);

        // Auto-release after duration
        this.timeout = setTimeout(() => {
            console.log(`[ActionLock] ⌛ Lock expired for ${source}`);
            this.release(source);
        }, durationMs);
    }

    release(source) {
        if (this.lockedBy === source) {
            this.lockedBy = null;
            this.priority = 0;
            if (this.timeout) clearTimeout(this.timeout);
            this.timeout = null;
            console.log(`[ActionLock] Released by ${source}`);
        }
    }

    forceRelease() {
        this.lockedBy = null;
        this.priority = 0;
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = null;
        console.log(`[ActionLock] ⚠️ Force released`);
    }

    isLocked() {
        return this.lockedBy !== null;
    }
}

module.exports = ActionLock;
