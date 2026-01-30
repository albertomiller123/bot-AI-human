const { getToolsForLLM, validateActionCall } = require('../../action-registry');

class TacticalAgent {
    constructor(ai) {
        this.ai = ai; // AIManager
    }

    async planExecution(instruction, context) {
        const tools = getToolsForLLM();
        const toolNames = tools.map(t => t.function.name).join(', ');

        let currentPrompt = `You are a Minecraft Tactical AI (Manager).
        
INSTRUCTION: "${instruction}"

AVAILABLE ACTIONS:
${toolNames}

Convert the instruction into a SPECIFIC JSON ACTION.
Output format: {"action": "name", "params": {...}}
`;

        // Retry logic handled here or in Orchestrator?
        // Let's implement simple retry here
        for (let i = 0; i < 3; i++) {
            try {
                const response = await this.ai.fast(currentPrompt, true); // System 1
                const action = this._parseJSON(response);

                if (action && action.action) {
                    const validation = validateActionCall(action.action, action.params || {});
                    if (validation.valid) return action;

                    console.warn(`[TacticalAgent] Validation failed: ${validation.error}`);
                    currentPrompt += `\nERROR: ${validation.error}. Fix it.`;
                }
            } catch (e) {
                console.error(`[TacticalAgent] Attempt ${i + 1} failed:`, e);
            }
        }

        return null; // Failed
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
