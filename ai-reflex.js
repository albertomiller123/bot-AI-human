const OpenAI = require('openai');

class AIReflex {
    constructor(apiKey, baseURL) {
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL
        });
        this.model = 'mistralai/mistral-nemotron'; // Fast Chat/Action model
        this.killCount = 0;
        this.recentDamage = 0;
    }

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
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100
            });
            return response.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            console.error("[AI Reflex] Chat failed:", error);
            return toxicity === 'panic' ? "LAG VCL" : "lag vcl";
        }
    }

    async handleQuickCommand(contextLite, message, username) {
        const msg = message.toLowerCase();

        // Manual Mapping for robustness (Vietnamese + English)
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

        // Fallback to fast model for other simple instructions
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
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0].message.content;
            return JSON.parse(content);
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
