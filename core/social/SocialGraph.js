const fs = require('fs');
const path = require('path');

class SocialGraph {
    constructor(config) {
        this.filePath = path.join(__dirname, '../../data/social/social_graph.json');
        this.config = config || {};
        this.data = {};
        this.load();
    }

    load() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            if (fs.existsSync(this.filePath)) {
                this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            }
        } catch (e) {
            console.error("[SocialGraph] Load Error:", e);
            this.data = {};
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error("[SocialGraph] Save Error:", e);
        }
    }

    getRole(username) {
        // 1. Check Config for Owner/Trusted (Highest Priority)
        // Assuming config is passed or we read from a global/env
        const owners = process.env.OWNER_LIST ? process.env.OWNER_LIST.split(',') : ['admin']; // Fallback
        const trusted = process.env.TRUSTED_LIST ? process.env.TRUSTED_LIST.split(',') : [];

        if (owners.includes(username)) return 'owner';
        if (trusted.includes(username)) return 'trusted';

        // 2. Check Persisted Graph
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
        this.save();
    }
}

module.exports = SocialGraph;
