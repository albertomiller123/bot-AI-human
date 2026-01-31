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
        this.isReady = false;

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
                    this.isReady = true;
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

    _estimateTokens(text) {
        // Safer estimate for Unicode/Vietnamese (Average 2.5 chars per token)
        return Math.ceil(text.length / 2.5);
    }

    async _sendRequest(type, prompt, jsonMode) {
        if (!this.worker) return null;

        // Waiting for Worker Initialization
        if (!this.isReady) {
            // Increased timeout: up to 30s (300 * 100ms) for slow models/machines
            let retries = 0;
            while (!this.isReady && retries < 300) {
                await new Promise(r => setTimeout(r, 100));
                retries++;
            }
            if (!this.isReady) {
                console.error("[AIManager] Worker not ready after 30s.");
                return null;
            }
        }

        // TOKEN SAFETY CHECK
        const estimatedTokens = this._estimateTokens(prompt);
        // Default safe limit: 8192 tokens (approx 32k chars)
        // Adjust based on model config if possible, but 8k is a good safe baseline for most modern models
        if (estimatedTokens > 8000) {
            console.warn(`[AIManager] ⚠️ Prompt too long! (~${estimatedTokens} tokens). Truncating...`);
            prompt = prompt.substring(0, 32000) + "\n...[SYSTEM: TRUNCATED DUE TO TOKEN LIMIT]";
        }

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

    async cleanup() {
        if (this.worker) {
            console.log("[AIManager] 🛑 Terminating AI Worker...");
            await this.worker.terminate();
            this.worker = null;
        }
        // Clear pending requests
        for (const [id, req] of this.pendingRequests) {
            clearTimeout(req.timeout);
            req.reject(new Error("AI Manager Cleanup"));
        }
        this.pendingRequests.clear();
    }

    _sanitizePayload(obj, depth = 0, maxDepth = 3) {
        // 1. Primitive checks
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // 2. Depth Limit
        if (depth >= maxDepth) {
            return "[MaxDepth]";
        }

        // 3. Handle Arrays
        if (Array.isArray(obj)) {
            const arr = [];
            for (let i = 0; i < obj.length; i++) {
                arr[i] = this._sanitizePayload(obj[i], depth + 1, maxDepth);
            }
            return arr;
        }

        // 4. Handle Objects
        const res = {};
        for (const key in obj) {
            // Filter large/circular keys
            if (key === 'bot' || key === 'botCore' || key === 'socket') continue;

            // Only copy own properties
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                res[key] = this._sanitizePayload(obj[key], depth + 1, maxDepth);
            }
        }
        return res;
    }

    cancelRequest(id) {
        if (this.pendingRequests.has(id)) {
            const request = this.pendingRequests.get(id);
            clearTimeout(request.timeout);
            request.reject(new Error("Request Cancelled (User/System Abort)"));
            this.pendingRequests.delete(id);

            // Send abort signal to worker
            if (this.worker) {
                this.worker.postMessage({ type: 'abort', id });
            }
            return true;
        }
        return false;
    }


    async fast(prompt, jsonMode = false) {
        return await this._sendRequest('fast', prompt, jsonMode);
    }

    async slow(prompt, jsonMode = false) {
        if (jsonMode) console.log("[AIManager] System 2 Thinking (Worker)...");
        return await this._sendRequest('slow', prompt, jsonMode);
    }

    async embed(text) {
        if (!this.worker) return null;
        const id = ++this.requestIdCounter;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error("Embedding Timeout"));
            }, 10000);

            this.pendingRequests.set(id, {
                resolve: resolve, // Content is the embedding array
                reject,
                timeout
            });

            this.worker.postMessage({ type: 'embed', id, text });
        });
    }
}

module.exports = AIManager;
