class CraftingModule {
    constructor(botCore) {
        this.botCore = botCore;
    }

    get bot() { return this.botCore.bot; }
    get mcData() { return this.botCore.mcData; }
    get primitives() { return this.botCore.primitives; }

    async craft_item(item_name, count = 1) {
        try {
            const item = this.mcData.itemsByName[item_name];
            if (!item) {
                return { success: false, message: `Unknown item: ${item_name}` };
            }

            const recipes = this.bot.recipesFor(item.id, null, 1, true);
            if (recipes.length === 0) {
                return { success: false, message: `No recipe or resources for ${item_name}` };
            }

            const recipe = recipes[0];
            let craftingTable = null;

            if (recipe.requiresTable) {
                craftingTable = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 32 });
                if (!craftingTable) {
                    return { success: false, message: "Crafting table required but not found." };
                }
                await this.primitives.move_to(craftingTable.position);
            }

            await this.bot.craft(recipe, count, craftingTable);
            return { success: true, message: `Crafted ${count} ${item_name}`, data: { item_name, count } };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async craft_if_possible(item_name) {
        try {
            await this.craft_item(item_name, 1);
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = CraftingModule;
