const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

const DEFAULT_PROMPT = "You are a highly capable Minecraft strategist bot. Plan tasks efficiently.";

class AIStrategy {
    constructor(apiKey, baseURL) {
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL
        });
        this.model = 'openai-gpt-oss-20b'; // Powerful Planning model
        this.systemPrompt = DEFAULT_PROMPT;

        // Load prompt asynchronously (non-blocking)
        this._loadSystemPrompt();
    }

    async _loadSystemPrompt() {
        try {
            this.systemPrompt = await fs.readFile(path.join(__dirname, 'system_prompt.txt'), 'utf8');
            console.log("[AI Strategy] Loaded custom system prompt.");
        } catch (e) {
            console.warn("[AI Strategy] Using default prompt, file load failed:", e.message);
        }
    }

    async createPlan(contextFull, command) {
        const prompt = `### FULL CONTEXT:\n${JSON.stringify(contextFull, null, 2)}\n\n### TASK:\n"${command}"\n\nCreate a detailed multi-step plan in JSON format.`;

        return this._executePrompt(prompt);
    }

    async createCorrectionPlan(originalTask, failedStep, errorMessage, contextFull) {
        const prompt = `### RECOVERY MODE
The previous plan failed.
Original Task: "${originalTask.complex_task}"
Failed Step: ${JSON.stringify(failedStep)}
Error: "${errorMessage}"
Current Context: ${JSON.stringify(contextFull, null, 2)}

Create a NEW JSON plan to fix this error and continue the task.
Return ONLY: { "complex_task": "Fixing error...", "steps": [...] }`;

        return this._executePrompt(prompt);
    }

    async _executePrompt(prompt) {
        try {
            console.log(`[AI Strategy] Planning with ${this.model}...`);
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            });

            const content = response.choices[0]?.message?.content;
            let jsonString = content.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || content;
            return JSON.parse(jsonString.trim());
        } catch (error) {
            console.error("[AI Strategy] Planning failed:", error);
            throw error;
        }
    }
}

module.exports = AIStrategy;
