class CraftingManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.mcData = null;
    }

    _loadData() {
        if (!this.mcData && this.bot.version) {
            this.mcData = require('minecraft-data')(this.bot.version);
        }
        return this.mcData;
    }

    async craftItem(itemName, count = 1) {
        const mcData = this._loadData();
        if (!mcData) return false;

        const item = mcData.itemsByName[itemName];
        if (!item) {
            console.log(`[Craft] Unknown item: ${itemName}`);
            return false;
        }

        const recipe = this.bot.recipesFor(item.id, null, 1, null)[0];
        if (!recipe) {
            console.log(`[Craft] No recipe for ${itemName} (or requires crafting table).`);
            // TODO: Handle crafting table requirement
            // If recipe requires table, look for one or craft one
            return this.craftWithTable(itemName, count);
        }

        try {
            console.log(`[Craft] Crafting ${count} ${itemName}...`);
            await this.bot.craft(recipe, count, null);
            return true;
        } catch (err) {
            console.log(`[Craft] Crafting failed: ${err.message}`);
            return false;
        }
    }

    async craftWithTable(itemName, count) {
        const item = this.mcData.itemsByName[itemName];
        const recipe = this.bot.recipesFor(item.id, null, 1, true)[0]; // passing true allows crafting bench recipes if we have access to one

        if (!recipe) {
            console.log(`[Craft] No recipe found even with table for ${itemName}`);
            return false;
        }

        // Find crafting table
        const tableBlock = this.bot.findBlock({
            matching: this.mcData.blocksByName.crafting_table.id,
            maxDistance: 32
        });

        if (!tableBlock) {
            console.log("[Craft] Need crafting table but none found. Crafting one...");
            // Logic to craft a table if we have wood
            // 1. Craft Planks
            // 2. Craft Table
            // 3. Place Table
            // For MVP Phase 1, just log error
            return false;
        }

        try {
            await this.bot.pathfinder.goto(new this.botCore.pathfinder.goals.GoalNear(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z, 3));
            await this.bot.craft(recipe, count, tableBlock);
            return true;
        } catch (err) {
            console.error(`[Craft] Table crafting failed: ${err.message}`);
            return false;
        }
    }
}

module.exports = CraftingManager;
