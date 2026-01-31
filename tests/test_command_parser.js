const CommandParser = require('../core/communication/CommandParser');

// Mock BotCore
const mockBotCore = {
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
    }
};

async function testParser() {
    console.log("=== TEST COMMAND PARSER ===");
    const parser = new CommandParser(mockBotCore);

    // Test 1: Command
    console.log("\n--- Case 1: Command ---");
    const res1 = await parser.parse("Steve", "Get 3 wood");
    console.log("Result:", JSON.stringify(res1, null, 2));

    if (res1.type === 'CMD' && res1.content.length === 2) {
        console.log("✅ PASS");
    } else {
        console.log("❌ FAIL");
    }
}

testParser();
