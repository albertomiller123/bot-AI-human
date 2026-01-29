const OpenAI = require('openai');

class AIRouter {
    constructor(apiKey, baseURL) {
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL
        });
        this.model = 'mistralai/mistral-nemotron'; // Quick Classification model
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
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });



            const content = response.choices[0].message.content;
            // Robust JSON extraction
            let jsonString = content.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || content;
            const parsed = JSON.parse(jsonString.trim());
            return parsed.intent;
        } catch (error) {
            console.error("[AI Router] Classification failed:", error);
            return 'CHATTING'; // Default fallback
        }
    }
}

module.exports = AIRouter;
