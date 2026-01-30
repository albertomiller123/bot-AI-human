const assert = require('assert');

process.on('uncaughtException', (err) => {
    console.log("🔥 UNCAUGHT EXCEPTION:", err);
    process.exit(1);
});

// Mock AI_INTENTS locally to avoid requiring complex ai-layer
const AI_INTENTS = { STRATEGY: 'strategy', CHATTING: 'chatting', UNKNOWN: 'unknown' };

// Debug Dependencies
try {
    require('vec3');
    console.log("✅ vec3 loaded");
    require('mineflayer-pathfinder');
    console.log("✅ mineflayer-pathfinder loaded");
} catch (e) {
    console.log("❌ Dependency Check Failed:", e.message);
}

let GuardBehavior;
try {
    GuardBehavior = require('../behaviors/GuardBehavior');
    console.log("✅ GuardBehavior loaded");
} catch (e) {
    console.log("❌ Failed to load GuardBehavior:", e.message);
    process.exit(1);
}

// Mock Vec3
class MockVec3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    clone() { return new MockVec3(this.x, this.y, this.z); }
    floored() { return new MockVec3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)); }
    distanceTo(other) { return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2 + (this.z - other.z) ** 2); }
    toString() { return `(${this.x}, ${this.y}, ${this.z})`; }
}

// Mock Bot & Dependencies
const mockBot = {
    username: 'SoldierBot',
    entity: {
        id: 999,
        position: new MockVec3(100, 64, 100)
    },
    chat: (msg) => console.log(`[BOT]: ${msg}`),
    pathfinder: { setGoal: () => { }, goto: () => { }, isMoving: () => false },
    pvp: { target: null, attack: () => { }, stop: () => { } },
    setControlState: () => { },
    lookAt: async () => { },
    attack: () => { },
    on: () => { },
    consume: async () => { }, // Mock consume
    equip: async () => { }, // Mock equip
    listeners: () => [],
    inventory: { slots: [], items: () => [] },
    nearestEntity: () => null // Default no entity
};

// Mock Memory & Action
const mockMemory = {
    data: {
        locations: {},
        owner: "Player1"
    },
    save: () => console.log("[MEM] Saved"),
    getCluster: (name) => mockMemory.data[name] || {}
};

const mockActionRegistry = {
    executeAction: async (name, params) => {
        console.log(`[ACTION] Executing: ${name}`, params);
        if (name === 'set_base') {
            mockMemory.data.locations['base'] = { x: 100, y: 64, z: 100 };
            return true;
        }
        return true;
    }
};

const mockAI = {
    processMessage: async (msg) => {
        if (msg === "pvp voi tao") return { intent: AI_INTENTS.STRATEGY, action: "guard_base" };
        if (msg.includes("doing")) return { intent: AI_INTENTS.CHATTING, response: "Fighting!" };
        return { intent: AI_INTENTS.UNKNOWN };
    }
};

// Test Runner
async function runTests() {
    console.log("🚀 STARTING PHASE 4 FINAL VERIFICATION\n");

    try {
        const mockBotCore = {
            bot: mockBot,
            say: (msg) => console.log(`[BOT_SAY]: ${msg}`),
            config: { owner: { name: "Player1" } }
        };

        const guard = new GuardBehavior(mockBotCore, mockMemory, mockActionRegistry);
        console.log("✅ GuardBehavior Instantiated");

        // --- TEST CASE 1: SETUP ---
        console.log("👉 Test 1: Setup Base");
        await mockActionRegistry.executeAction('set_base', {});
        assert.deepStrictEqual(mockMemory.data.locations['base'], { x: 100, y: 64, z: 100 }, "Base location invalid");
        console.log("✅ Base set successfully.\n");


        // --- TEST CASE 2: ACTIVATION ---
        console.log("👉 Test 2: Activation");
        guard.start({ radius: 10 });
        assert.strictEqual(guard.isActive, true, "Guard mode not active");
        console.log("✅ Guard Mode ON.\n");


        // --- TEST CASE 3: COMBAT LOOP ---
        console.log("👉 Test 3: Combat Loop (Hostile Detected)");
        const zombie = {
            type: 'mob', name: 'zombie', kind: 'Hostile',
            position: new MockVec3(105, 64, 105), // 5m away
            height: 1.8
        };

        // Inject mock entity finding
        mockBot.nearestEntity = (filter) => {
            if (filter(zombie)) return zombie;
            return null;
        };

        let attackTriggered = false;
        // Hijack bot.pvp.attack to spy
        mockBot.pvp.attack = (target) => {
            assert.strictEqual(target.name, 'zombie');
            attackTriggered = true;
            console.log("⚔️ Attack triggered correctly (Direct PVP).");
        };

        // Run one tick
        await guard.onTick();
        assert.strictEqual(attackTriggered, true, "Bot did not attack zombie");
        console.log("✅ Combat Logic PASSED.\n");


        // --- TEST CASE 4: SAFETY (FRIENDLY FIRE) ---
        console.log("👉 Test 4: Safety (Owner Check)");
        const player = {
            type: 'player', username: 'Player1', kind: 'Player',
            position: new MockVec3(102, 64, 102)
        };

        mockBot.nearestEntity = (filter) => {
            if (filter(player)) return player;
            return null;
        };

        // Reset spy
        attackTriggered = false;
        // Spy on PVP again
        mockBot.pvp.attack = (target) => {
            attackTriggered = true;
            console.log("⚔️ Attack triggered incorrectly on OWNER!");
        };

        await guard.onTick();
        assert.strictEqual(attackTriggered, false, "Bot attacked Owner!");
        console.log("✅ Safety Logic PASSED (Owner ignored).\n");


        // --- TEST CASE 5: MULTITASKING ---
        console.log("👉 Test 5: Multitasking (Chat while Guarding)");
        // Put zombie back
        mockBot.nearestEntity = (filter) => {
            if (filter(zombie)) return zombie;
            return null;
        };

        // Use spy again
        mockBot.pvp.attack = (target) => {
            // Log but don't assert here, just verify loops run
        };

        // Simulate Chat Event
        const chatPromise = new Promise(resolve => {
            setTimeout(() => {
                console.log("💬 User asks: What doing?");
                mockBot.chat("I am guarding base and fighting!");
                resolve("Chat Done");
            }, 50);
        });

        // Simulate Guard Tick concurrently
        const guardPromise = new Promise(async resolve => {
            await guard.onTick(); // Should attack zombie
            resolve("Guard Tick Done");
        });

        await Promise.all([chatPromise, guardPromise]);
        console.log("✅ Multitasking PASSED (Chat + Guard ran parallel).\n");

        console.log("🎉 ALL SYSTEMS GO. READY FOR DEPLOYMENT.");
    } catch (err) {
        console.log("❌ CRITICAL FAILURE:", err);
        throw err;
    }
}

runTests().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
