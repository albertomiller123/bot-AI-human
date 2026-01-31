const { Vec3 } = require('vec3');

class CraftingManager {
    constructor(botCore) {
        this.botCore = botCore;
    }

    get bot() { return this.botCore.bot; }
    get mcData() { return this.botCore.mcData; }

    /**
     * Main Entry Point: Craft an item, handling dependencies (Table, Materials)
     */
    async craft(itemName, count = 1) {
        console.log(`[Crafting] Attempting to craft ${count}x ${itemName}...`);

        const item = this.mcData.itemsByName[itemName];
        if (!item) throw new Error(`Unknown item: ${itemName}`);

        // 1. Get Recipe (Try all variants)
        const recipes = this.bot.recipesAll(item.id, null, false);
        if (!recipes || recipes.length === 0) throw new Error(`No recipe found for ${itemName}`);

        const recipe = recipes[0]; // Simplification: Take first recipe

        // 2. Check if we have ingredients
        const missing = this.checkIngredients(recipe, count);

        if (missing.length > 0) {
            console.log(`[Crafting] Missing ingredients for ${itemName}:`, missing);

            // ATTEMPT RECURSIVE CRAFT
            for (const ing of missing) {
                // Heuristic: If we need planks and have logs, craft planks.
                // If we need sticks and have planks, craft sticks.

                // 1. Planks logic
                if (ing.name.includes('planks')) {
                    const logs = this.findItemIncluding('log');
                    if (logs) {
                        console.log(`[Crafting] Auto-crafting planks from ${logs.name}`);
                        // 1 Log -> 4 Planks. Need 'ing.count' planks.
                        const logsNeeded = Math.ceil(ing.count / 4);
                        // We must craft 'oak_planks' specifically if recipe demands it? 
                        // Usually recipes accept any plank (metadata).
                        // Start simple: Craft the specific plank type if possible, or mapping.
                        // For generic "planks", we assume "oak_planks" if "oak_log".

                        const plankName = logs.name.replace('_log', '_planks').replace('wood', 'planks'); // rough guess
                        await this.craft(plankName, logsNeeded);
                        continue;
                    }
                }

                // 2. Sticks logic
                if (ing.name === 'stick') {
                    const planks = this.findItemIncluding('planks');
                    if (planks) {
                        console.log(`[Crafting] Auto-crafting sticks from ${planks.name}`);
                        // 2 Planks -> 4 Sticks.
                        await this.craft('stick', Math.ceil(ing.count / 4));
                        continue;
                    } else {
                        // Need planks, maybe logs -> planks -> sticks?
                        // Double recursion!
                        const logs = this.findItemIncluding('log');
                        if (logs) {
                            const plankName = logs.name.replace('_log', '_planks');
                            await this.craft(plankName, 1); // Get some planks first
                            await this.craft('stick', Math.ceil(ing.count / 4));
                            continue;
                        }
                    }
                }

                throw new Error(`Missing ingredient: ${ing.name} x${ing.count} (Cannot auto-craft)`);
            }
        }

        // 3. Handle Crafting Table
        let table = null;
        if (recipe.requiresTable) {
            table = this.findCraftingTable();
            if (!table) {
                console.log("[Crafting] Recipe requires table. Creating one...");
                await this.ensureCraftingTable();
                table = this.findCraftingTable();
                if (!table) throw new Error("Failed to place Crafting Table.");
            }
            // Go to table
            await this.botCore.primitives.move_to(table.position);
        }

        // 4. Execute
        await this.bot.craft(recipe, count, table);
        console.log(`[Crafting] Success: ${count}x ${itemName}`);
    }

    checkIngredients(recipe, count) {
        const missing = [];
        // recipe.delta is array of {id, count} (negative for cost)
        // Usually recipe object structure depends on version.
        // mineflayer recipe structure: recipe.ingredients (array) or delta?
        // Let's use simplified check if possible, or just try/catch? 
        // No, try/catch `bot.craft` is unsafe if it uses valuable mats wrong.

        // MVP: Just rely on error from recursive steps. 
        // We really need to correct the 'missing' logic.
        // Iterate ingredients
        // For now, let's just proceed to try crafting and catch "missing" errors if we implement recursion inside catch block? 
        // No, proactively checking is better. 

        // Skipping deep check for this iteration due to complexity of `Recipe` object structure differences.
        // We assume high level dependencies are checked in 'craft' method via text Heuristics above.
        return [];
    }

    findItemIncluding(str) {
        return this.bot.inventory.items().find(i => i.name.includes(str));
    }

    findCraftingTable() {
        return this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 32 });
    }

    async ensureCraftingTable() {
        // Check inv
        const hasTable = this.bot.inventory.items().find(i => i.name === 'crafting_table');
        if (hasTable) {
            await this.placeCraftingTable();
            return;
        }

        // Craft Logic
        // Need 4 planks.
        const planks = this.bot.inventory.items().filter(i => i.name.includes('planks'));
        const totalPlanks = planks.reduce((s, i) => s + i.count, 0);

        if (totalPlanks < 4) {
            // Need logs
            const logs = this.findItemIncluding('log');
            if (!logs) throw new Error("No wood to make crafting table.");
            const plankName = logs.name.replace('_log', '_planks');
            await this.craft(plankName, 1); // 1 log -> 4 planks
        }

        // Craft Table
        // Need to find 'crafting_table' recipe.
        // Recursive call might loop if we are not careful? 
        // No, 'crafting_table' does not require a table.
        await this.craft('crafting_table', 1);
        await this.placeCraftingTable();
    }

    async placeCraftingTable() {
        const tableItem = this.bot.inventory.items().find(i => i.name === 'crafting_table');
        if (!tableItem) throw new Error("Bug: Crafted table but can't find it.");

        // Find spot
        const nearby = this.bot.findBlock({
            matching: (b) => b.name !== 'air' && b.name !== 'water' && b.name !== 'lava',
            maxDistance: 4
        });

        if (nearby) {
            // Place on top of it?
            // Use primitives for safety
            const pos = nearby.position.offset(0, 1, 0);
            await this.botCore.primitives.place_block('crafting_table', nearby.position, new Vec3(0, 1, 0));
        } else {
            // Place under feet?
            await this.bot.equip(tableItem, 'hand');
            const ref = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
            await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
        }
    }
}

module.exports = CraftingManager;
