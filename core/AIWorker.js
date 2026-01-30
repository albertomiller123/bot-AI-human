const { parentPort, workerData } = require('worker_threads');
const OpenAI = require('openai');

let client = null;
let fallbackClient = null;
let config = null;

// Track active requests for cancellation
const activeRequests = new Map(); // id -> AbortController

// Simple Rate Limiter (Token Bucket)
class RateLimiter {
    constructor(maxRequests, perWindowMs) {
        this.maxRequests = maxRequests;
        this.perWindowMs = perWindowMs;
        this.timestamps = [];
    }

    tryAcquire() {
        const now = Date.now();
        // Remove old timestamps
        this.timestamps = this.timestamps.filter(t => now - t < this.perWindowMs);

        if (this.timestamps.length >= this.maxRequests) {
            return false;
        }

        this.timestamps.push(now);
        return true;
    }
}

const rateLimiter = new RateLimiter(20, 60000); // 20 requests per minute

function init(workerConfig) {
    config = workerConfig;
    if (config.apiKey) {
        client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL
        });
    }

    if (config.fallbackURL && config.fallbackKey) {
        fallbackClient = new OpenAI({
            apiKey: config.fallbackKey,
            baseURL: config.fallbackURL
        });
    }
}

async function callAI(data) {
    const { type, prompt, jsonMode, id } = data;

    // 1. Rate Limit check
    if (!rateLimiter.tryAcquire()) {
        return { id, error: `Rate limit exceeded (${rateLimiter.maxRequests} req/min). Please slow down.` };
    }

    if (!client && !fallbackClient) {
        return { id, error: "No AI Client initialized in Worker" };
    }

    // 2. Setup Abort Controller for this request
    const controller = new AbortController();
    activeRequests.set(id, controller);

    const modelConfig = type === 'fast' ? config.fast : config.slow;
    const modelName = modelConfig.model;
    const maxTokens = modelConfig.max_tokens;
    const temperature = modelConfig.temperature;

    const tryCall = async (aiClient, isFallback) => {
        const makeRequest = async (useJsonMode) => {
            // Note: AbortSignal is NOT passed to openai client currently due to DataCloneError issues in Worker threads.
            // We use "soft cancellation" by checking signal state before/after calls.
            return await aiClient.chat.completions.create({
                model: isFallback ? "mistralai/mistral-nemotron" : modelName,
                messages: [{ role: 'user', content: prompt }],
                timeout: 60000,
                max_tokens: maxTokens,
                temperature: temperature,
                response_format: useJsonMode ? { type: "json_object" } : undefined
            });
        };

        try {
            if (controller.signal.aborted) throw new Error("Aborted");

            // First attempt with requested JSON mode
            const response = await makeRequest(jsonMode);

            if (controller.signal.aborted) throw new Error("Aborted");
            return response.choices[0].message.content;
        } catch (e) {
            if (e.message === "Aborted") throw e;

            // Check for JSON mode incompatibility (usually 400 Bad Request)
            if (jsonMode && e.status === 400 && e.error?.type === 'invalid_request_error') {
                if (controller.signal.aborted) throw new Error("Aborted");
                const response = await makeRequest(false);
                return response.choices[0].message.content;
            }
            throw e;
        }
    };

    try {
        if (client) {
            try {
                const content = await tryCall(client, false);
                return { id, success: true, content };
            } catch (e) {
                if (e.message === "Aborted") throw e;
                console.error(`[AIWorker] Primary failed: ${e.message}`);
                if (!fallbackClient) throw e;
            }
        }

        if (fallbackClient) {
            if (controller.signal.aborted) throw new Error("Aborted");
            const content = await tryCall(fallbackClient, true);
            return { id, success: true, content, fallback: true };
        }
    } catch (finalError) {
        if (finalError.message === 'Aborted') {
            return { id, success: false, error: "Request Cancelled" };
        }
        return { id, success: false, error: finalError.message };
    } finally {
        activeRequests.delete(id);
    }
}

function handleAbort(id) {
    const controller = activeRequests.get(id);
    if (controller) {
        controller.abort();
        activeRequests.delete(id);
        console.log(`[AIWorker] Aborted request ${id} (Soft)`);
    }
}

// Message Listener
if (parentPort) {
    parentPort.on('message', async (message) => {
        try {
            if (message.type === 'init') {
                init(message.config);
                parentPort.postMessage({ type: 'init_done' });
            } else if (message.type === 'call') {
                const result = await callAI(message.data);
                // Ensure plain result for cloning
                const safeResult = {
                    id: result.id,
                    success: result.success,
                    content: result.content ? String(result.content) : undefined,
                    error: result.error ? String(result.error) : undefined,
                    fallback: result.fallback
                };
                parentPort.postMessage({ type: 'result', result: safeResult });
            } else if (message.type === 'abort') {
                handleAbort(message.id);
            }
        } catch (err) {
            console.error(`[AIWorker] Fatal Message Error:`, err);
        }
    });
}
