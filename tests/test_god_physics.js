const PhysicsManager = require('../core/physics/PhysicsManager');
console.log("Loaded PhysicsManager");

const mockBot = {
    entity: {
        position: { x: 0, y: 100, z: 0 },
        velocity: { y: -1.0 },
        onGround: false
    },
    inventory: {
        items: () => [{ name: 'water_bucket', count: 1 }],
        slots: []
    },
    equip: async (item) => console.log(`[Mock] Equipped ${item.name}`),
    lookAt: async () => { },
    activateItem: async () => console.log('[Mock] Used Item'),
    blockAt: (pos) => ({ name: 'air' }),
    world: {
        raycast: (start, dir, dist) => {
            console.log("Raycast called");
            return {
                intersect: { x: 0, y: 0, z: 0 },
                position: { x: 0, y: 0, z: 0 }
            };
        }
    },
    findBlocks: () => []
};

// Add helper methods to position mock AFTER creation because they reference themselves? 
// Or just plain functions.
mockBot.entity.position.distanceTo = () => 10;
mockBot.entity.position.floored = () => ({ x: 0, y: 0, z: 0 });

const mockBotCore = { bot: mockBot };

async function testMLG() {
    console.log("Start testMLG");
    try {
        const pm = new PhysicsManager(mockBotCore);
        console.log("Created PM");

        pm.isFalling = true;
        pm.fallStartY = 110;

        console.log("Calling attemptMLG");
        await pm.attemptMLG();
        console.log("Called attemptMLG");
    } catch (e) {
        console.log("Caught in testMLG:", e.stack);
    }
}

(async () => {
    await testMLG();
})();
