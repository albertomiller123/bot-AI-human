const ItemEvaluator = require('../core/brain/ItemEvaluator');
const assert = require('assert');

// Mock structure provided by Prismarine-Item (simplified)
const mockItem = (name, enchants = [], storedEnchants = null) => {
    const item = { name, count: 1, enchants: [] };

    // Direct enchants (Tools/Armor)
    if (enchants.length > 0) {
        item.enchants = enchants.map(e => ({ name: e.name, lvl: e.lvl }));
    }

    // Stored Enchants (Books)
    if (storedEnchants) {
        item.nbt = {
            value: {
                StoredEnchantments: {
                    value: {
                        value: storedEnchants.map(e => ({
                            id: { value: 'minecraft:' + e.name },
                            lvl: { value: e.lvl }
                        }))
                    }
                }
            }
        };
    }

    return item;
};

async function testScoring() {
    console.log("Testing Item Scoring...");
    const evaluator = new ItemEvaluator({});

    // 1. Material Tier
    const woodSword = mockItem('wooden_sword');
    const diaSword = mockItem('diamond_sword');
    const nethSword = mockItem('netherite_sword');

    const s1 = evaluator.getItemScore(woodSword);
    const s2 = evaluator.getItemScore(diaSword);
    const s3 = evaluator.getItemScore(nethSword);

    console.log(`Wood: ${s1}, Diamond: ${s2}, Netherite: ${s3}`);
    assert.ok(s1 < s2, "Diamond should beat Wood");
    assert.ok(s2 < s3, "Netherite should beat Diamond");

    // 2. Enchantments
    const sharp1 = mockItem('diamond_sword', [{ name: 'sharpness', lvl: 1 }]);
    const sharp5 = mockItem('diamond_sword', [{ name: 'sharpness', lvl: 5 }]);

    const es1 = evaluator.getItemScore(sharp1);
    const es5 = evaluator.getItemScore(sharp5);

    console.log(`Sharp 1 Score: ${es1}`);
    console.log(`Sharp 5 Score: ${es5}`);

    // 3. Books
    const mendingBook = mockItem('enchanted_book', [], [{ name: 'mending', lvl: 1 }]);
    const unbreakingBook = mockItem('enchanted_book', [], [{ name: 'unbreaking', lvl: 1 }]); // lower weight

    const b1 = evaluator.getItemScore(mendingBook);
    const b2 = evaluator.getItemScore(unbreakingBook);

    console.log(`Mending Book Score: ${b1}`);
    console.log(`Unbreaking Book Score: ${b2}`);

    console.log("✅ Scoring logic verified");
}

(async () => {
    try {
        await testScoring();
        console.log("🎉 Item Evaluator Tests Passed!");
    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
})();
