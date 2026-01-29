class UpgradeManager {
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

    async checkUpgrade() {
        const mcData = this._loadData();
        if (!mcData) return;

        const tools = ['pickaxe', 'sword', 'axe', 'shovel'];
        const inv = this.bot.inventory.items();

        // 1. Wood -> Stone
        if (this.hasItem('cobblestone', 3) && this.hasItem('stick', 2)) {
            const stonePick = inv.find(i => i.name.includes('stone_pickaxe'));
            if (!stonePick) {
                console.log("[Upgrade] Should craft Stone Pickaxe.");
                // Trigger craft
                return 'craft_stone_pickaxe';
            }
        }

        // 2. Stone -> Iron
        if (this.hasItem('iron_ingot', 3) && this.hasItem('stick', 2)) {
            const ironPick = inv.find(i => i.name.includes('iron_pickaxe'));
            if (!ironPick) {
                console.log("[Upgrade] Should craft Iron Pickaxe.");
                return 'craft_iron_pickaxe';
            }
        }

        // 3. Armor Checks
        // TODO

        return null;
    }

    hasItem(name, count) {
        const item = this.bot.inventory.items().find(i => i.name === name);
        return item && item.count >= count;
    }
}

module.exports = UpgradeManager;
