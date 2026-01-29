const fs = require('fs');
const path = require('path');

class CognitiveSystem {
    constructor(botCore) {
        this.botCore = botCore;
        this.shortTermMemory = []; // Raw logs
        this.longTermPath = path.join(__dirname, '../data/ltm_summary.json');

        // Config: Summarize every 50 events or 10 minutes
        this.batchSize = 50;
    }

    start() {
        // Hook into event bus or logger
        // For MVP, we'll expose a log() method used by other systems
        setInterval(() => this.consolidateMemory(), 10 * 60 * 1000); // 10 mins auto-save
    }

    logExperience(type, detail) {
        const entry = { timestamp: Date.now(), type, detail };
        this.shortTermMemory.push(entry);

        if (this.shortTermMemory.length >= this.batchSize) {
            this.consolidateMemory();
        }
    }

    async consolidateMemory() {
        if (this.shortTermMemory.length === 0) return;

        console.log("[Cognitive] Consolidating Memory (System 2 Wake Up)...");

        const recentLogs = this.shortTermMemory.map(e => `[${new Date(e.timestamp).toTimeString().split(' ')[0]}] ${e.type}: ${e.detail}`).join('\n');

        // Ask System 2 to summarize
        const prompt = `You are the memory system of a Minecraft bot.
SHORT TERM LOGS:
${recentLogs}

TASK:
1. Summarize key events (e.g. "Found diamond", "Killed by user1").
2. Discard routine movement or noise (e.g. "Walked to...").
3. Output a concise summary paragraph to be added to Long Term Memory.`;

        const summary = await this.botCore.aiLayer.brain.slow(prompt, false);

        if (summary) {
            this._appendToLTM(summary);
            this.shortTermMemory = []; // Flush STM
            console.log("[Cognitive] Memory Consolidated.");
        }
    }

    _appendToLTM(summary) {
        let ltm = [];
        if (fs.existsSync(this.longTermPath)) {
            ltm = JSON.parse(fs.readFileSync(this.longTermPath));
        }

        ltm.push({ date: new Date().toISOString(), summary });

        // Pruning (Keep last 50 summaries)
        if (ltm.length > 50) ltm.shift();

        fs.writeFileSync(this.longTermPath, JSON.stringify(ltm, null, 2));
    }
}

module.exports = CognitiveSystem;
