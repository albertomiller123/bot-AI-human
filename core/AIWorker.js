/**
 * core/AIWorker.js
 * Handles AI API calls and Heavy JSON Parsing in a separate thread.
 * Prevents main thread blocking during large payload processing.
 */

const { parentPort, workerData } = require('worker_threads');
const OpenAI = require('openai');

let client = null;
let fallbackClient = null;
let config = null;

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

    if (!client && !fallbackClient) {
        return { id, error: "No AI Client initialized in Worker" };
    }

    const modelConfig = type === 'fast' ? config.fast : config.slow;
    const modelName = modelConfig.model;
    const maxTokens = modelConfig.max_tokens;
    const temperature = modelConfig.temperature;

    const tryCall = async (aiClient, isFallback) => {
        const makeRequest = async (useJsonMode) => {
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
            // First attempt with requested JSON mode
            const response = await makeRequest(jsonMode);
            return response.choices[0].message.content;
        } catch (e) {
            // Check for JSON mode incompatibility (usually 400 Bad Request)
            if (jsonMode && e.status === 400 && e.error?.type === 'invalid_request_error') {
                console.warn(`[AIWorker] JSON mode failed (400), retrying without response_format...`);
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
                console.error(`[AIWorker] Primary failed: ${e.message}`);
                if (!fallbackClient) throw e;
            }
        }

        if (fallbackClient) {
            const content = await tryCall(fallbackClient, true);
            return { id, success: true, content, fallback: true };
        }
    } catch (finalError) {
        return { id, success: false, error: finalError.message };
    }
}

// Message Listener
if (parentPort) {
    parentPort.on('message', async (message) => {
        if (message.type === 'init') {
            init(message.config);
            parentPort.postMessage({ type: 'init_done' });
        } else if (message.type === 'call') {
            const result = await callAI(message.data);
            parentPort.postMessage({ type: 'result', result });
        }
    });
}
