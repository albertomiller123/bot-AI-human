class StrategicAgent {
    constructor(ai) {
        this.ai = ai; // AIManager
        this.failureCount = 0;
        this.lastGoal = "";
    }

    async think(context, visualContext, goal) {
        // Reflection Logic
        let errorContext = "";
        if (goal === this.lastGoal) {
            this.failureCount++;
            if (this.failureCount > 0) {
                errorContext = `\nWARNING: The previous plan for this goal FAILED (Attempt ${this.failureCount}). YOU MUST CHANGE STRATEGY. Do not repeat the same steps.`;
            }
        } else {
            this.failureCount = 0;
            this.lastGoal = goal;
        }

        // Use PromptBuilder logic manually for now (since we don't import it here yet)
        const prompt = `You are a Minecraft Strategic AI (CEO). 
        
GOAL: "${goal}"

CURRENT SITUATION:
- Health: ${context.health}/20
- Food: ${context.food}/20
- Position: ${JSON.stringify(context.position)}
- Inventory: ${JSON.stringify(context.inventory)}
- Visual: ${visualContext.description}
${errorContext}

Analyze the situation and create a high-level plan (3-5 steps).
Each step should be actionable but not too low-level.
Example: "Go to the forest and chop wood", "Return to base and smelt iron".

Output ONLY a JSON array of strings: ["step1", "step2"]`;

        try {
            const result = await this.ai.slow(prompt, true); // System 2
            return this._parseJSON(result);
        } catch (e) {
            console.error("[StrategicAgent] Thinking failed:", e);
            return [];
        }
    }

    _parseJSON(content) {
        try {
            // Basic extraction if surrounded by text
            const jsonParams = content.match(/\[.*\]/s);
            if (jsonParams) return JSON.parse(jsonParams[0]);
            return JSON.parse(content);
        } catch (e) {
            return [];
        }
    }
}

module.exports = StrategicAgent;
