const OpenAI = require('openai');

class AIManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.config = null;
        this.client = null;

        this._init();
    }

    _init() {
        try {
            // Load from centralized settings
            const settings = require('../config/settings.json');
            this.config = settings.ai;

            // Validate required config structure
            if (!this.config?.fast?.model || !this.config?.slow?.model) {
                throw new Error("Invalid AI config: missing fast.model or slow.model");
            }

            // API Key availability check
            const apiKey = process.env.MEGALLM_API_KEY;
            if (!apiKey) {
                console.warn("[AIManager] ⚠️ MEGALLM_API_KEY missing! AI features DISABLED.");
                this.config = null; // Explicit disable
                return;
            }

            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: this.config.baseURL || "https://ai.megallm.io/v1"
            });

            console.log(`[AIManager] ✅ Dual-Brain initialized. Fast: ${this.config.fast.model}, Slow: ${this.config.slow.model}`);
        } catch (e) {
            console.error("[AIManager] ❌ CRITICAL: Failed to init AI:", e.message);
            console.error("[AIManager] AI features will be DISABLED!");
            this.config = null;
        }
    }

    /**
     * System 1: Fast, Reflexive, Combat, Chat Banter
     * Model: mistralai/mistral-nemotron
     */
    async fast(prompt, jsonMode = false) {
        if (!this.client) return null;

        try {
            const response = await this.client.chat.completions.create({
                model: this.config.fast.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: this.config.fast.max_tokens,
                temperature: this.config.fast.temperature,
                response_format: jsonMode ? { type: "json_object" } : undefined
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error(`[AIManager/Fast] Error: ${error.message}`);
            return null;
        }
    }

    /**
     * System 2: Slow, Strategic, Planning, Analysis
     * Model: openai-gpt-oss-20b
     */
    async slow(prompt, jsonMode = false) {
        if (!this.client) return null;

        try {
            console.log("[AIManager] System 2 Thinking...");
            const response = await this.client.chat.completions.create({
                model: this.config.slow.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: this.config.slow.max_tokens,
                temperature: this.config.slow.temperature,
                response_format: jsonMode ? { type: "json_object" } : undefined
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error(`[AIManager/Slow] Error: ${error.message}`);
            return null;
        }
    }
}

module.exports = AIManager;
