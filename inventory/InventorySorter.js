class InventorySorter {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    async sort() {
        // Phase 5 Stability: Use ActionLock with low priority (3) and short timeout (1s)
        if (this.botCore.actionLock && !this.botCore.actionLock.tryAcquire('inventory_sort', 3, 1000)) {
            console.log('[Inventory] Busy (ActionLock), skipping sort.');
            return;
        }

        try {
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
                await this.bot.moveSlotItem(bestPick.slot, 37).catch(() => { });
            }

            const bestSword = items.find(i => i.name.includes('sword'));
            if (bestSword && bestSword.slot !== 36) { // Slot 1
                await this.bot.moveSlotItem(bestSword.slot, 36).catch(() => { });
            }
        } catch (error) {
            console.error("[Inventory] Sort failed:", error.message);
        } finally {
            if (this.botCore.actionLock) this.botCore.actionLock.release('inventory_sort');
        }
    }
}

module.exports = InventorySorter;
