const EventEmitter = require('events');

class CommandParser extends EventEmitter {
    constructor(botCore) {
        super();
        this.botCore = botCore;
    }

    /**
     * Parse a natural language message into a structured intent
     * @param {string} username 
     * @param {string} message 
     * @returns {Promise<{type: 'CHAT'|'CMD', content: any}>}
     */
    async parse(username, message) {
        // 1. Fast Intent Classification (System 1)
        // Use Fast AI to determine if this is a command or chitchat
        const intentPrompt = `
        Classify the following message from Minecraft player "${username}":
        "${message}"
        
        Types:
        - CMD: Request to do something (build, move, gather, kill, come, stop, etc.)
        - CHAT: Casual conversation, greeting, question, or insult (e.g. "hi", "u suck", "where am i")

        Output ONLY JSON: {"type": "CMD" | "CHAT"}
        `;

        try {
            const intentRes = await this.botCore.aiManager.fast(intentPrompt, true);
            let intent = { type: 'CHAT' };
            try {
                intent = JSON.parse(intentRes);
            } catch (e) {
                // Fallback: simple keyword check
                if (/build|kill|go|come|craft|get|mine/i.test(message)) intent.type = 'CMD';
            }

            if (intent.type === 'CHAT') {
                return { type: 'CHAT', content: message }; // Pass through to ChatEngine
            }

            // 2. Task Decomposition (System 2)
            // Use Slow AI to break down the command into a Job Queue
            console.log(`[CommandParser] 🧠 Analyzing Task: "${message}"...`);

            const taskPrompt = `
            You are a Minecraft Task Planner.
            User "${username}" says: "${message}"

            Break this into a list of specific actions from this registry:
            - say_message(message)
            - pathfind_to(x, y, z) OR pathfind_to(targetName)
            - find_and_collect(item_name, quantity)
            - craft_item(item_name, count)
            - build_area(block_name, area) 
            - attack_target(target_name)
            - follow_player(name)
            - stop_actions()
            - give_item_to_player(username, item_name, quantity)

            Rules:
            1. If vague location "here", use "current_location".
            2. If "build house", plan: gather wood -> craft planks -> build_structure.
            3. Output STRICT JSON Array.

            Example Output:
            [
                {"goal": "find_and_collect", "params": {"item_name": "oak_log", "quantity": 10}},
                {"goal": "craft_item", "params": {"item_name": "oak_planks", "count": 40}},
                {"goal": "build_area", "params": {"block_name": "oak_planks", "area": {"min": {"x": 10, "y": 64, "z": 10}, "max": {"x": 15, "y": 64, "z": 15}}}}
            ]
            `;

            const planRes = await this.botCore.aiManager.slow(taskPrompt, true);
            let jobQueue = [];
            try {
                // Extract JSON if wrapped in markdown
                const jsonMatch = planRes.match(/\[.*\]/s);
                const jsonStr = jsonMatch ? jsonMatch[0] : planRes;
                jobQueue = JSON.parse(jsonStr);
            } catch (e) {
                console.error("[CommandParser] Failed to parse plan JSON:", e);
                return { type: 'CHAT', content: "I tried to understand your command but got confused. (JSON Error)" };
            }

            if (!Array.isArray(jobQueue) || jobQueue.length === 0) {
                return { type: 'CHAT', content: "I don't know how to do that yet." };
            }

            return { type: 'CMD', content: jobQueue };

        } catch (err) {
            console.error("[CommandParser] AI Error:", err);
            return { type: 'CHAT', content: "My brain hurts (AI Error)." };
        }
    }
}

module.exports = CommandParser;
