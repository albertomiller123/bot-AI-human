const GuardBehavior = require('../behaviors/GuardBehavior');
const { Vec3 } = require('vec3');

console.log("🧪 Testing GuardBehavior logic...");

// Mock Bot Dependencies
const mockBot = {
    username: 'Bot',
    entity: { position: new Vec3(0, 60, 0) },
    health: 20,
    food: 20,
    pvp: {
        attack: (target) => console.log(`[MockPVP] Attacking ${target.username || target.name}`),
        stop: () => console.log("[MockPVP] Stopped")
    },
    pathfinder: {
        setGoal: (g) => console.log(`[MockPathfinder] Goal set to ${g.x}, ${g.y}, ${g.z}`),
        isMoving: () => false
    },
    inventory: { items: () => [] },
    nearestEntity: (filter) => {
        // Mock finding a zombie
        const zombie = { type: 'hostile', position: new Vec3(5, 60, 5), name: 'Zombie', isValid: true };
        if (filter(zombie)) return zombie;
        return null;
    }
};

const mockCore = {
    bot: mockBot,
    config: { owner: { name: 'Owner' } },
    say: (msg) => console.log(`[BotSay] ${msg}`)
};

async function test() {
    const guard = new GuardBehavior(mockCore);

    // Test 1: Start
    console.log("\n--- Test 1: Start ---");
    guard.start(10);
    if (!guard.isActive || guard.radius !== 10) {
        console.error("❌ Failed to start correctly.");
        process.exit(1);
    }

    // Test 2: Scan & Engage (Tick)
    console.log("\n--- Test 2: Scan & Engage ---");
    await guard.tick();
    if (guard.engageTarget?.name === 'Zombie') {
        console.log("✅ Detected and engaged zombie.");
    } else {
        console.error("❌ Failed to engage zombie.");
        process.exit(1);
    }

    // Test 3: Whitelist Safety
    console.log("\n--- Test 3: Whitelist Safety ---");
    // Mock owner nearby
    mockBot.nearestEntity = (filter) => {
        const owner = { type: 'player', position: new Vec3(2, 60, 2), username: 'Owner', isValid: true };
        if (filter(owner)) return owner;
        return null;
    };
    guard.engageTarget = null; // Reset
    await guard.tick();
    if (guard.engageTarget) {
        console.error("❌ Guard attacked Owner! Whitelist failed.");
        process.exit(1);
    } else {
        console.log("✅ Correctly ignored Owner.");
    }

    // Test 4: Stop
    console.log("\n--- Test 4: Stop ---");
    guard.stop();
    if (guard.isActive) {
        console.error("❌ Failed to stop.");
        process.exit(1);
    }

    console.log("\n🎉 All Guard Tests Passed!");
    process.exit(0);
}

test();
