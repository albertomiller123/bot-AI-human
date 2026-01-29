const OpenAI = require('openai');

class AIManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.config = null;
        this.client = null;
        this.fallbackClient = null;

        this._init();
    }

    _init() {
        try {
            // Priority: ENV > config file
            const envBaseURL = process.env.AI_BASE_URL;
            const envModelFast = process.env.AI_MODEL_FAST;
            const envModelSlow = process.env.AI_MODEL_SLOW;

            // Load from config file as fallback
            const settings = require('../config/settings.json');
            const fileConfig = settings.ai || {};

            // Merge config: ENV takes priority
            this.config = {
                baseURL: envBaseURL || fileConfig.baseURL || "https://ai.megallm.io/v1",
                fast: {
                    model: envModelFast || fileConfig.fast?.model || "mistralai/mistral-nemotron",
                    max_tokens: fileConfig.fast?.max_tokens || 200,
                    temperature: fileConfig.fast?.temperature || 0.6
                },
                slow: {
                    model: envModelSlow || fileConfig.slow?.model || "openai-gpt-oss-20b",
                    max_tokens: fileConfig.slow?.max_tokens || 1000,
                    temperature: fileConfig.slow?.temperature || 0.2
                }
            };

            // API Key availability check
            const apiKey = process.env.MEGALLM_API_KEY;
            if (!apiKey) {
                console.warn("[AIManager] ⚠️ MEGALLM_API_KEY missing! AI features DISABLED.");
                this.config = null;
                return;
            }

            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: this.config.baseURL
            });

            // Setup fallback client if configured
            const fallbackURL = process.env.AI_FALLBACK_URL;
            const fallbackKey = process.env.AI_FALLBACK_KEY;
            if (fallbackURL && fallbackKey) {
                this.fallbackClient = new OpenAI({
                    apiKey: fallbackKey,
                    baseURL: fallbackURL
                });
                console.log(`[AIManager] 🔄 Fallback API configured: ${fallbackURL.substring(0, 30)}...`);
            }

            console.log(`[AIManager] ✅ Dual-Brain initialized.`);
            console.log(`[AIManager]    Base URL: ${this.config.baseURL}`);
            console.log(`[AIManager]    Fast: ${this.config.fast.model}, Slow: ${this.config.slow.model}`);
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
