const BlacksmithManager = require('../core/crafting/BlacksmithManager');
const assert = require('assert');

// Mock Bot
const mockBot = {
    entity: { yaw: 0, pitch: 0 },
    experience: { level: 5 },
    inventory: {
        items: () => [
            { name: 'experience_bottle', count: 64 },
            { name: 'diamond_sword', count: 1 },
            { name: 'enchanted_book', count: 1 }
        ]
    },
    equip: async (item) => console.log(`[Mock] Equipping ${item.name}`),
    look: async () => { },
    activateItem: async () => {
        console.log("[Mock] Throwing XP");
        mockBot.experience.level += 5; // Simulate XP gain
    },
    findBlock: () => ({ position: { x: 10, y: 64, z: 10 }, name: 'anvil' }),
    openAnvil: async () => ({
        combine: async (t, s) => console.log(`[Mock] Combined ${t.name} + ${s.name}`),
        close: () => console.log("[Mock] Closed Anvil")
    })
};

const mockBotCore = {
    bot: mockBot,
    primitives: { move_to: async () => console.log("[Mock] Moved to Anvil") }
};

async function testXP() {
    console.log("Testing XP Logic...");
    const bm = new BlacksmithManager(mockBotCore);

    // reset level
    mockBot.experience.level = 5;

    const success = await bm.ensureXP(15);

    console.log(`Level after: ${mockBot.experience.level}`);
    assert.ok(mockBot.experience.level >= 15, "Should have reached level 15");
    assert.ok(success, "ensureXP should return true");
}

async function testAnvil() {
    console.log("Testing Anvil Logic...");
    const bm = new BlacksmithManager(mockBotCore);

    const success = await bm.startAnrilRoutine('diamond_sword', 'enchanted_book');
    assert.ok(success, "Anvil routine should succeed");
}

(async () => {
    try {
        await testXP();
        await testAnvil();
        console.log("🎉 Blacksmith Tests Passed!");
    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
})();
