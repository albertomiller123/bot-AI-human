const Primitives = require('../primitives');
const { Vec3 } = require('vec3');

console.log("🧪 Testing set_base() primitive...");

// Mock dependencies
const mockMemory = {
    savedData: {},
    saveLocation: async (name, pos) => {
        mockMemory.savedData[name] = pos;
        console.log(`[MockMemory] Saved '${name}' at ${pos}`);
        return Promise.resolve();
    }
};

const mockBotCore = {
    bot: {
        entity: {
            position: new Vec3(100, 64, -200)
        }
    },
    memory: mockMemory,
    say: (msg) => console.log(`[BotSay] ${msg}`)
};

async function test() {
    // Instantiate Primitives with mock core
    const prim = new Primitives(mockBotCore);

    try {
        await prim.set_base();

        // Assertions
        if (mockMemory.savedData['base']) {
            const saved = mockMemory.savedData['base'];
            if (saved.x === 100 && saved.y === 64 && saved.z === -200) {
                console.log("✅ set_base() saved correct coordinates.");
                process.exit(0);
            } else {
                console.error("❌ set_base() saved WRONG coordinates:", saved);
                process.exit(1);
            }
        } else {
            console.error("❌ set_base() did not save 'base' location.");
            process.exit(1);
        }

    } catch (e) {
        console.error("❌ set_base() threw error:", e);
        process.exit(1);
    }
}

test();
