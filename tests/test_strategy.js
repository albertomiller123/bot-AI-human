const StrategyBrain = require('../core/brain/StrategyBrain');

// Mock Everything
const mockBot = {
    username: 'Bot',
    health: 20,
    entity: { position: { distanceTo: () => 5, minus: () => ({ normalize: () => ({ scaled: () => ({}) }), plus: () => ({}) }) } },
    entities: {},
    inventory: { items: () => [] },
    equip: async () => { },
    look: async () => { },
    activateItem: () => { },
    pathfinder: { setGoal: () => { } }
};

const mockBotCore = {
    bot: mockBot,
    config: { owner: { name: 'Owner' } },
    primitives: { move_to: async () => { } },
    crystalCombat: { start: () => { }, stop: () => { } },
    behaviors: { combat: { attack: async () => { } } }
};

async function testStrategy() {
    console.log("Testing Strategy Brain...");
    const brain = new StrategyBrain(mockBotCore);

    // Scenario 1: Idle (No enemies)
    mockBot.entities = {};
    let proposal = await brain.getProposal();
    console.log(`Scenario 1 (Idle): ${proposal ? proposal.id : 'None'}`);
    if (proposal !== null) console.error("FAIL: Should be null (Idle)");

    // Scenario 2: Weak Enemy (Caution) -- Simulate Player
    mockBot.entities = {
        '1': { type: 'player', username: 'Noob', position: { distanceTo: () => 10 }, equipment: [] }
    };
    proposal = await brain.getProposal();
    console.log(`Scenario 2 (Weak Enemy): ${proposal ? proposal.id : 'None'}`);
    if (proposal?.id !== 'strategy_combat_bully') console.error("FAIL: Should be bully");

    // Scenario 3: Strong Enemy (Danger)
    mockBot.entities = {
        '1': {
            type: 'player', username: 'Pro', position: { distanceTo: () => 10 },
            equipment: [
                { name: 'netherite_helmet' },
                { name: 'netherite_chestplate' },
                { name: 'netherite_leggings' },
                { name: 'netherite_boots' }
            ]
        }
    };
    proposal = await brain.getProposal();
    console.log(`Scenario 3 (Strong Enemy): ${proposal ? proposal.id : 'None'}`);
    if (proposal?.id !== 'strategy_combat_crystal') console.error("FAIL: Should be crystal");

    // Scenario 4: Lethal (Low HP)
    mockBot.health = 4;
    proposal = await brain.getProposal();
    console.log(`Scenario 4 (Low HP): ${proposal ? proposal.id : 'None'}`);
    if (proposal?.id !== 'strategy_survival_retreat') console.error("FAIL: Should be retreat");

    console.log("✅ Strategy Tests Done");
}

(async () => {
    try {
        await testStrategy();
    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
})();
