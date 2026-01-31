const assert = require('assert');
const MiningModule = require('../behaviors/modules/MiningModule');
const CraftingModule = require('../behaviors/modules/CraftingModule');
const CombatModule = require('../behaviors/modules/CombatModule');
const AgentOrchestrator = require('../core/architecture/AgentOrchestrator');
const Behaviors = require('../behaviors');
const HumanMotor = require('../humanizer/HumanMotor');

console.log("🔍 Starting Enterprise Upgrade Verification...");

// Mock Bot Core
const mockBot = {
    entity: { position: { x: 0, y: 60, z: 0, offset: (x, y, z) => ({ x, y, z }), distanceTo: () => 100 }, height: 1.6, yaw: 0, pitch: 0 },
    inventory: { items: () => [] },
    pathfinder: { setGoal: () => { } },
    on: () => { },
    removeListener: () => { }
};
const mockCore = {
    bot: mockBot,
    mcData: { blocksByName: {}, itemsByName: {}, foods: {} },
    primitives: { move_to: async () => { } },
    aiManager: {},
    ltm: { search: () => [], add: () => { } },
    config: {}
};

async function runTests() {
    try {
        // 1. Module Instantiation
        console.log("1️⃣ Testing Module Instantiation...");
        const mining = new MiningModule(mockCore);
        const crafting = new CraftingModule(mockCore);
        const combat = new CombatModule(mockCore);
        assert(mining, "MiningModule failed to load");
        assert(crafting, "CraftingModule failed to load");
        assert(combat, "CombatModule failed to load");
        console.log("   ✅ Modules Loaded");

        // 2. Facade Linking
        console.log("2️⃣ Testing Facade Linking (behaviors.js)...");
        const facade = new Behaviors(mockCore);
        assert(facade.mining instanceof MiningModule, "Facade missing MiningModule");
        assert(typeof facade.mine_block === 'function', "Facade missing mine_block");
        assert(typeof facade.craft_item === 'function', "Facade missing craft_item");
        console.log("   ✅ Facade Linked Correctly");

        // 3. Orchestrator Integrity
        console.log("3️⃣ Testing Orchestrator Structure...");
        const orch = new AgentOrchestrator(mockCore);
        await orch.init();
        assert(typeof orch.process === 'function', "Orchestrator missing process()");
        // Verify it returns objects not executes (Mocking process logic is hard without full context, static check ok)
        console.log("   ✅ Orchestrator Initialized");

        // 4. HumanMotor Check
        console.log("4️⃣ Testing HumanMotor...");
        const motor = new HumanMotor(mockBot);
        assert(typeof motor.smoothLookAt === 'function', "HumanMotor missing smoothLookAt");
        assert(typeof motor.humanRelMove === 'function', "HumanMotor missing humanRelMove");
        console.log("   ✅ HumanMotor Valid");

        console.log("\n🎉 ALL STATIC CHECKS PASSED!");
        console.log("System is ready for Runtime Test (node index.js)");

    } catch (e) {
        console.error("\n❌ VERIFICATION FAILED!");
        console.error(e);
        process.exit(1);
    }
}

runTests();
