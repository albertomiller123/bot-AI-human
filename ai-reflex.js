const OpenAI = require('openai');

class AIReflex {
    constructor(brain) {
        this.brain = brain; // AIManager
        this.killCount = 0;
        this.recentDamage = 0;
    }

    // ... (keep getToxicityLevel and getMoodPrompt unchanged) ...

    // Dynamic toxicity based on game state
    getToxicityLevel(contextLite) {
        if (contextLite.health < 5) return 'panic';        // Rage-quit mode
        if (this.killCount > 3) return 'arrogant';         // Cocky after kills
        if (contextLite.health < 10) return 'aggressive';  // Extra threatening
        if (this.recentDamage > 10) return 'vengeful';     // Payback mode
        return 'normal';
    }

    getMoodPrompt(toxicityLevel) {
        const moodPrompts = {
            panic: 'You are PANICKING. Type in ALL CAPS, threaten to quit, blame everyone. Examples: "THOI DMM BO CHOI", "LAG VCL KO CHOI NUA"',
            arrogant: 'You are EXTREMELY arrogant. Mock everyone, use "ez", "get good", "non qua". Be condescending.',
            aggressive: 'You are extra AGGRESSIVE and threatening. Promise violence, use strong language.',
            vengeful: 'You are seeking REVENGE. Promise to hunt down and kill whoever hurt you. Very intense.',
            normal: 'You are a standard toxic Vietnamese gamer - rude, cocky, impatient.'
        };
        return moodPrompts[toxicityLevel] || moodPrompts.normal;
    }

    async handleChat(contextLite, message) {
        const toxicity = this.getToxicityLevel(contextLite);
        const moodPrompt = this.getMoodPrompt(toxicity);

        const prompt = `You are a toxic Vietnamese Minecraft gamer.
CURRENT MOOD: ${toxicity.toUpperCase()}
${moodPrompt}

STYLE RULES:
- USE GAMER SLANG (vcl, deo, ga, non, oc cho, dmm, wtf, ...).
- Speak naturally like a VN gamer. Texting style (ko dau) is preferred but readable.
- Short, impatient replies (max 1-2 sentences).
- If context.busy is true, be annoyed that you are interrupted.
- NEVER be helpful or polite.

Example:
User: "chao ban"
You: "deo quen, cut"
User: "may dang lam gi day"
You: "mu a ma ko thay tao dang ban"

Context: Health=${contextLite.health}, Busy=${contextLite.is_busy}
Player: "${message}"

Reply (Vietnamese no accents, match current mood):`;

        try {
            // Use Fast Brain (Worker) - No JSON Mode needed for chat, but fast model is fine
            // Wait, we want raw text here.
            const content = await this.brain.fast(prompt, false);
            return content ? content.trim().toLowerCase() : (toxicity === 'panic' ? "LAG VCL" : "lag vcl");
        } catch (error) {
            console.error("[AI Reflex] Chat failed:", error);
            return toxicity === 'panic' ? "LAG VCL" : "lag vcl";
        }
    }

    async handleQuickCommand(contextLite, message, username) {
        const msg = message.toLowerCase();

        // Manual Mapping (Keep existing logic)
        if (msg.includes("stop") || msg.includes("ngừng") || msg.includes("dung lai")) {
            return { action: "stop_actions", params: {} };
        }
        if (msg.includes("nhảy") || msg.includes("jump")) {
            return { action: "jump", params: {} };
        }
        if (msg.includes("theo") || msg.includes("follow") || msg.includes("lai day") || msg.includes("come here")) {
            return { action: "follow_player", params: { name: username } };
        }
        if (msg.includes("chat") || msg.includes("noi")) {
            return { action: "say_message", params: { message: "ok noi gi" } };
        }

        // Fallback to fast model (Worker)
        const prompt = `Convert this Minecraft command to a single-step JSON action: "${message}"
Context: ${JSON.stringify(contextLite)}
Sender: ${username}

AVAILABLE ACTIONS: follow_player, stop_actions, jump, say_message, attack_target, mine_block
Rules:
- If "follow me" -> action: "follow_player", params: { "name": "${username}" }
- If "stop" -> action: "stop_actions"
- If invalid/unknown -> return null

Output ONLY valid JSON.
Example: {"action": "name", "params": {}}`;

        try {
            // Use Fast Brain with JSON Mode
            const content = await this.brain.fast(prompt, true);
            return JSON.parse(content || "null");
        } catch (error) {
            return null;
        }
    }

    // Track kills for adaptive behavior
    recordKill() {
        this.killCount++;
        console.log(`[AI Reflex] Kill count: ${this.killCount} - Arrogance increasing...`);
    }

    recordDamage(amount) {
        this.recentDamage += amount;
        // Decay damage memory over time
        setTimeout(() => { this.recentDamage = Math.max(0, this.recentDamage - amount); }, 30000);
    }

    resetKillCount() {
        this.killCount = 0;
    }
}

module.exports = AIReflex;
