const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');

class AIManager extends EventEmitter {
    constructor(botCore) {
        super();
        this.botCore = botCore;
        this.worker = null;
        this.config = null;
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;

        this._init();
    }

    _init() {
        try {
            // Priority: ENV > config file
            const envBaseURL = process.env.AI_BASE_URL;
            const settings = require('../config/settings.json');
            const fileConfig = settings.ai || {};

            this.config = {
                baseURL: envBaseURL || fileConfig.baseURL || "https://ai.megallm.io/v1",
                fast: {
                    model: process.env.AI_MODEL_FAST || fileConfig.fast?.model || "mistralai/mistral-nemotron",
                    max_tokens: fileConfig.fast?.max_tokens || 200,
                    temperature: fileConfig.fast?.temperature || 0.6
                },
                slow: {
                    model: process.env.AI_MODEL_SLOW || fileConfig.slow?.model || "openai-gpt-oss-20b",
                    max_tokens: fileConfig.slow?.max_tokens || 1000,
                    temperature: fileConfig.slow?.temperature || 0.2
                },
                apiKey: process.env.MEGALLM_API_KEY,
                fallbackURL: process.env.AI_FALLBACK_URL,
                fallbackKey: process.env.AI_FALLBACK_KEY
            };

            if (!this.config.apiKey) {
                console.warn("[AIManager] ⚠️ MEGALLM_API_KEY missing! AI features DISABLED.");
                return;
            }

            // Spawn Worker
            const workerPath = path.join(__dirname, 'AIWorker.js');
            this.worker = new Worker(workerPath);

            // Message Handler
            this.worker.on('message', (msg) => {
                if (msg.type === 'init_done') {
                    console.log("[AIManager] ✅ AI Worker Initialized.");
                } else if (msg.type === 'result') {
                    this._handleResult(msg.result);
                }
            });

            this.worker.on('error', (err) => {
                console.error("[AIManager] ❌ Worker Error:", err);
            });

            this.worker.on('exit', (code) => {
                if (code !== 0) console.error(`[AIManager] Worker stopped with exit code ${code}`);
            });

            // Init Worker Config
            this.worker.postMessage({ type: 'init', config: this.config });

        } catch (e) {
            console.error("[AIManager] ❌ Failed to init:", e);
        }
    }

    _handleResult(result) {
        const { id, success, content, error } = result;
        const request = this.pendingRequests.get(id);

        if (request) {
            if (success) {
                request.resolve(content);
            } else {
                request.reject(new Error(error));
            }
            this.pendingRequests.delete(id);
        }
    }

    async _sendRequest(type, prompt, jsonMode) {
        if (!this.worker) return null;

        const id = ++this.requestIdCounter;

        return new Promise((resolve, reject) => {
            // Timeout handler
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("AI Worker Timeout"));
                }
            }, 60000);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            const payload = { id, type, prompt, jsonMode };

            try {
                // Safety sanitization to prevent Circular Reference crashes
                const safePayload = this._sanitizePayload(payload);

                this.worker.postMessage({
                    type: 'call',
                    data: safePayload
                });
            } catch (err) {
                this.pendingRequests.delete(id);
                clearTimeout(timeout);
                reject(new Error(`Worker Send Error: ${err.message}`));
            }
        });
    }

    _sanitizePayload(obj) {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            // Remove huge objects or circular refs if necessary
            if (key === 'bot' || key === 'botCore') return undefined; // Should not happen in prompt/jsonMode, but safe to filter
            return value;
        }));
    }

    cancelRequest(id) {
        if (this.pendingRequests.has(id)) {
            const request = this.pendingRequests.get(id);
            clearTimeout(request.timeout);
            request.reject(new Error("Request Cancelled (Race Condition / Timeout)"));
            this.pendingRequests.delete(id);
            return true;
        }
        return false;
    }


    async fast(prompt, jsonMode = false) {
        try {
            return await this._sendRequest('fast', prompt, jsonMode);
        } catch (e) {
            console.error(`[AIManager/Fast] Error: ${e.message}`);
            return null;
        }
    }

    async slow(prompt, jsonMode = false) {
        try {
            if (jsonMode) console.log("[AIManager] System 2 Thinking (Worker)...");
            return await this._sendRequest('slow', prompt, jsonMode);
        } catch (e) {
            console.error(`[AIManager/Slow] Error: ${e.message}`);
            return null;
        }
    }
}

module.exports = AIManager;
