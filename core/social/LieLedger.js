const fs = require('fs');
const path = require('path');

class LieLedger {
    constructor() {
        this.filePath = path.join(__dirname, '../../data/social/lie_ledger.json');
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
            console.error("[LieLedger] Load Error:", e);
            this.data = {};
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error("[LieLedger] Save Error:", e);
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
        this.data[username].facts_told.push({
            text: fact,
            timestamp: Date.now()
        });
        this.save();
    }

    /**
     * Check if a new statement contradicts previous lies
     * (Simple string matching for MVP)
     */
    checkConsistency(username, newStatement) {
        const facts = this.getFacts(username);
        // MVP: Just return the facts for the AI to check in the prompt
        return facts.map(f => f.text);
    }
}

module.exports = LieLedger;
