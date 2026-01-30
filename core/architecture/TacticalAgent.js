const fs = require('fs');
const path = require('path');
const { getToolsForLLM, validateActionCall } = require('../../action-registry');

class TacticalAgent {
    constructor(ai) {
        this.ai = ai;
        this.taskQueue = [];
        this.statePath = path.join(__dirname, '../../data/brain_state.json');
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = fs.readFileSync(this.statePath, 'utf8');
                const state = JSON.parse(data);
                this.taskQueue = state.taskQueue || [];
                console.log(`[Tactical] Restored ${this.taskQueue.length} pending tasks.`);
            }
        } catch (e) {
            console.error("[Tactical] Failed to load state:", e.message);
        }
    }

    saveState() {
        try {
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const state = { taskQueue: this.taskQueue, timestamp: Date.now() };
            fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
        } catch (e) {
            console.error("[Tactical] Failed to save state:", e.message);
        }
    }

    async planExecution(instruction, context) {
        // 1. Queue Management
        // Check if this instruction is already active (resume after crash)
        let activeTask = this.taskQueue[0];

        if (!activeTask || activeTask.step !== instruction) {
            // New Task
            activeTask = {
                step: instruction,
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            };
            this.taskQueue.push(activeTask);
            this.saveState();
        }

        const tools = getToolsForLLM();
        const toolNames = tools.map(t => t.function.name).join(', ');

        const prompt = `You are a Minecraft Tactical AI (Manager).
        
INSTRUCTION: "${instruction}"

AVAILABLE ACTIONS:
${toolNames}

Convert the instruction into a SPECIFIC JSON ACTION.
Output format: {"action": "name", "params": {...}}
`;

        try {
            // 2. Execution (AI Translation)
            const response = await this.ai.fast(prompt, true);
            const action = this._parseJSON(response);

            // 3. Validation
            if (action && action.action) {
                const validation = validateActionCall(action.action, action.params || {});

                if (validation.valid) {
                    // Success!
                    console.log(`[Tactical] ✅ Action Generated: ${action.action}`);
                    this.taskQueue.shift(); // Remove from queue
                    this.saveState();
                    return action;
                } else {
                    console.warn(`[Tactical] Validation failed: ${validation.error}`);
                    // Fallthrough to retry
                }
            }

            // 4. Failure Handling
            activeTask.retries = (activeTask.retries || 0) + 1;
            console.warn(`[Tactical] ⚠️ Task Failed (Attempt ${activeTask.retries}/3)`);

            if (activeTask.retries >= 3) {
                console.error("[Tactical] ❌ Max retries reached. Dropping task.");
                this.taskQueue.shift();
                this.saveState();
            } else {
                this.saveState();
            }

            return null;

        } catch (e) {
            console.error("[Tactical] Error:", e);
            // Non-destructive error (network, etc) - Keep in queue
            return null;
        }
    }

    _parseJSON(content) {
        try {
            const match = content.match(/\{.*\}/s);
            if (match) return JSON.parse(match[0]);
            return JSON.parse(content);
        } catch (e) { return null; }
    }
}

module.exports = TacticalAgent;
