class InventorySorter {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    async sort() {
        console.log("[Inventory] Sorting items (Tetris mode)...");
        // Logic:
        // Hotbar 1: Sword
        // Hotbar 2: Pickaxe
        // Hotbar 3: Axe/Shovel
        // Hotbar 4: Food
        // Hotbar 9: Blocks

        const items = this.bot.inventory.items();

        // MVP: Just ensure Pickaxe is in slot 1 (index 36+1?)
        // Mineflayer hotbar starts at 36

        const bestPick = items.find(i => i.name.includes('pickaxe'));
        if (bestPick && bestPick.slot !== 37) { // Slot 2
            await this.bot.moveSlotItem(bestPick.slot, 37);
        }

        const bestSword = items.find(i => i.name.includes('sword'));
        if (bestSword && bestSword.slot !== 36) { // Slot 1
            await this.bot.moveSlotItem(bestSword.slot, 36);
        }

        // TODO: Full complex sort
    }
}

module.exports = InventorySorter;
