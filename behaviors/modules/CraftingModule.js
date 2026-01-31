const CraftingManager = require('../../core/crafting/CraftingManager');

class CraftingModule {
    constructor(botCore) {
        this.botCore = botCore;
        this.manager = new CraftingManager(botCore);
    }

    async craft_item(item_name, count = 1) {
        try {
            await this.manager.craft(item_name, count);
            return { success: true, message: `Crafted ${count} ${item_name}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async craft_if_possible(item_name) {
        try {
            await this.manager.craft(item_name, 1);
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = CraftingModule;
