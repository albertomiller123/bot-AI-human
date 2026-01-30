const GuardBehavior = require('../behaviors/GuardBehavior');
const { Vec3 } = require('vec3');

console.log("🧪 Testing Dual-Brain (Guard + Chat) Multitasking...");

// 1. Mock Bot & Dependencies
const mockBot = {
    entity: { position: new Vec3(0, 60, 0) },
    pvp: { stop: () => { }, attack: () => { } },
    pathfinder: { setGoal: () => { }, isMoving: () => false },
    inventory: { items: () => [] },
    nearestEntity: () => null // Mock: No enemies found during chat test
};

const mockCore = {
    bot: mockBot,
    config: { owner: { name: 'Admin' } },
    say: (msg) => console.log(`[BotChat] ${msg}`)
};

// 2. Setup Guard
const guard = new GuardBehavior(mockCore);
guard.start();

// 3. Simulation Loop
let guardTicks = 0;
let chatReplies = 0;

// Override Guard tick to count
const originalTick = guard.tick.bind(guard);
guard.tick = async () => {
    guardTicks++;
    // console.log(`[Guard] Tick ${guardTicks}`);
    await originalTick();
};

async function simulateChat() {
    console.log("[User] 'Status report?'");
    await new Promise(r => setTimeout(r, 50));
    mockCore.say("I am guarding the base! (Chat Reply)");
    chatReplies++;
}

async function runTest() {
    console.log("--- Starting Simulation (2s) ---");
    setTimeout(() => simulateChat(), 500);
    await new Promise(r => setTimeout(r, 2000));

    guard.stop();

    console.log("\n--- Results ---");
    console.log(`Guard Ticks: ${guardTicks} (Expected ~2)`);
    console.log(`Chat Replies: ${chatReplies} (Expected 1)`);

    if (guardTicks >= 1 && chatReplies === 1) {
        console.log("✅ PASSED: Guard loop ran AND Chat replied.");
        process.exit(0);
    } else {
        console.error("❌ FAILED: Multitasking check failed.");
        process.exit(1);
    }
}

runTest();
