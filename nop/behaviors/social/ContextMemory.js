const fs = require('fs');
const path = require('path');

class ContextMemory {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        // Define relationships
        this.RELATIONSHIPS = {
            FRIEND: 1,   // Trust, protect, follow
            NEUTRAL: 0,  // Cautious, ignore
            NEMESIS: -1  // Hostile, avoid or KOS
        };

        this.memoryPath = path.join(__dirname, '../../../data/memory.json');
        this.socialGraph = {};

        // Ensure data dir exists
        const dataDir = path.dirname(this.memoryPath);
        if (!fs.existsSync(dataDir)) {
            try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { }
        }

        this.load();
    }

    // --- MEMORY IO ---
    load() {
        try {
            if (fs.existsSync(this.memoryPath)) {
                this.socialGraph = JSON.parse(fs.readFileSync(this.memoryPath, 'utf8'));
            }
        } catch (err) {
            console.log('[Memory] Failed to load memory:', err.message);
            this.socialGraph = {};
        }
    }

    save() {
        try {
            fs.writeFileSync(this.memoryPath, JSON.stringify(this.socialGraph, null, 2));
        } catch (err) {
            console.log('[Memory] Failed to save memory:', err.message);
        }
    }

    // --- INTERACTION LOGIC ---

    getRelationship(username) {
        return this.socialGraph[username] || this.RELATIONSHIPS.NEUTRAL;
    }

    markFriend(username) {
        if (this.socialGraph[username] !== this.RELATIONSHIPS.FRIEND) {
            this.socialGraph[username] = this.RELATIONSHIPS.FRIEND;
            this.botCore.say(`Thanks ${username}! Best friends now <3`);
            this.save();
        }
    }

    markNemesis(username) {
        if (this.socialGraph[username] !== this.RELATIONSHIPS.NEMESIS) {
            this.socialGraph[username] = this.RELATIONSHIPS.NEMESIS;
            console.log(`[Memory] ${username} is now a NEMESIS.`);
            this.save();
        }
    }

    // --- EVENT HANDLERS ---

    // Called when player drops item near bot
    handleItemDrop(username, item) {
        // Simple logic: If player drops item close to us, they are friendly
        this.markFriend(username);
    }

    // Called when bot takes damage
    handleDamage(attacker) {
        if (attacker && attacker.type === 'player') {
            const username = attacker.username;
            // Forgiveness check? For now, instant Nemesis
            this.markNemesis(username);
        }
    }
}

module.exports = ContextMemory;
