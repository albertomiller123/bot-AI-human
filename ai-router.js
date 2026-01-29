const OpenAI = require('openai');

class AIRouter {
    constructor(brain) {
        this.brain = brain; // AIManager (Worker wrapper)
    }

    async classifyIntent(message, contextLite) {
        // Heuristic: If message explicitly asks for tasks, force STRATEGY
        const taskKeywords = ['mine', 'crush', 'build', 'craft', 'kill', 'attack', 'farm', 'find', 'go to', 'tim', 'dao', 'xay', 'giet', 'che tao', 'kiem', 'di toi'];
        const msgOwner = message.toLowerCase();

        // Force Command Mode if explicitly asked with "!" or specific action verbs
        if (message.startsWith('!') || message.startsWith('/') || taskKeywords.some(k => msgOwner.includes(k))) {
            return 'STRATEGY';
        }

        const prompt = `Classify the following user message into one of these intents:
1. CHATTING: Normal conversation, greetings, questions about the world.
2. REFLEX: Immediate simple actions (e.g., "stop", "come here", "jump", "follow me", "theo toi", "dung lai", "nhay", "di theo tao").
3. STRATEGY: Complex tasks requiring planning (e.g., "build a house", "go mine 10 diamonds", "di dao go", "di dao vang", "xay nha").

User Message: "${message}"
Bot Context: ${JSON.stringify(contextLite)}

Return ONLY a JSON object: {"intent": "INTENT_NAME", "reason": "brief reason"}`;

        try {
            // Use Fast Brain (Worker) with JSON Mode
            const content = await this.brain.fast(prompt, true);
            const parsed = JSON.parse(content || "{}");
            return parsed.intent || 'CHATTING';
        } catch (error) {
            console.error("[AI Router] Classification failed:", error);
            return 'CHATTING'; // Default fallback
        }
    }
}

module.exports = AIRouter;
