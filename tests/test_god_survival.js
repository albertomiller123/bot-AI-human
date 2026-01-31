const ConsumableManager = require('../core/survival/ConsumableManager');
const assert = require('assert');

// Mock BotCore and Mineflayer Bot
const mockBot = {
    entity: { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 },
    inventory: {
        slots: new Array(46).fill(null),
        items: () => []
    },
    equip: async (item, dest) => {
        console.log(`[Mock] Equipping ${item.name} to ${dest}`);
        if (dest === 'off-hand') mockBot.inventory.slots[45] = item;
    },
    look: async () => { },
    activateItem: () => console.log('[Mock] Item Activated'),
    health: 20
};

const mockBotCore = {
    bot: mockBot,
    behaviors: { combat: { getNearbyEnemies: () => [] } }
};

async function testAutoTotem() {
    console.log("Testing Auto-Totem...");
    const manager = new ConsumableManager(mockBotCore);

    // Setup Inventory: Totem in main inv, Empty Offhand
    const totem = { name: 'totem_of_undying', count: 1 };
    mockBot.inventory.items = () => [totem];
    mockBot.inventory.slots[45] = null;

    // Run Check
    await manager.checkOffhand();

    // Verify
    assert.strictEqual(mockBot.inventory.slots[45], totem, "Offhand should contain Totem");
    console.log("✅ Auto-Totem Passed");
}

async function testEmergencyHeal() {
    console.log("Testing Emergency Heal...");
    const manager = new ConsumableManager(mockBotCore);
    mockBot.health = 4; // Critical

    const potion = { name: 'splash_potion', nbt: { value: { Potion: { value: 'minecraft:acting_healing' } } } };
    mockBot.inventory.items = () => [potion];

    // Spy on look/activate
    let lookedDown = false;
    let threw = false;
    mockBot.look = async (y, p) => { if (p === -Math.PI / 2) lookedDown = true; };
    mockBot.activateItem = () => { threw = true; };

    await manager.tick(); // Should trigger emergencyHeal

    assert.ok(lookedDown, "Should look down");
    assert.ok(threw, "Should throw potion");
    console.log("✅ Emergency Heal Passed");
}

(async () => {
    try {
        await testAutoTotem();
        await testEmergencyHeal();
        console.log("🎉 All Tests Passed!");
    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
})();
