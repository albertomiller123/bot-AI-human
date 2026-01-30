class StrategicAgent {
    constructor(ai) {
        this.ai = ai; // AIManager
    }

    async think(context, visualContext, goal) {
        const prompt = `You are a Minecraft Strategic AI (CEO). 
        
GOAL: "${goal}"

CURRENT SITUATION:
- Health: ${context.health}/20
- Food: ${context.food}/20
- Position: ${JSON.stringify(context.position)}
- Inventory: ${context.inventory}
- Visual: ${visualContext.description}
- Looking At: ${JSON.stringify(visualContext.lookingAt)}

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
