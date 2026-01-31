const BotCore = require('../bot-core');
const ChatEngine = require('../behaviors/social/ChatEngine');
const AIManager = require('../core/AIManager');

// Mock BotCore
const mockBotCore = {
    bot: {
        username: 'BotAI',
        chat: (msg) => console.log(`[Bot Chat]: ${msg}`),
        on: () => { },
        nearestEntity: () => null
    },
    aiManager: {
        fast: async (prompt) => {
            console.log("[MockAI Fast] Prompt:", prompt.substring(0, 50) + "...");
            if (prompt.includes("Types:")) return JSON.stringify({ type: "CMD" });
            return JSON.stringify({ type: "CHAT" });
        },
        slow: async (prompt) => {
            console.log("[MockAI Slow] Prompt:", prompt.substring(0, 50) + "...");
            return JSON.stringify([
                { goal: "find_and_collect", params: { name: "oak_log", count: 3 } },
                { goal: "craft_item", params: { name: "planks", count: 12 } }
            ]);
        }
    },
    taskManager: {
        addTask: (plan, user, urgent) => {
            console.log("[MockTaskManager] Received Plan:", JSON.stringify(plan, null, 2));
        }
    },
    survivalSystem: {
        cognitive: { logExperience: () => { } }
    }
};

async function testAutonomy() {
    console.log("=== TEST AUTONOMY (Command Parser) ===");
    const chatEngine = new ChatEngine(mockBotCore);

    // Simulate User Message
    const user = "Steve";
    const msg = "Get 3 wood and make planks";

    console.log(`User: ${msg}`);
    await chatEngine.handleChat(user, msg);
}

testAutonomy();
