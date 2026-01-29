class InventoryManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.baseTrash = ['dirt', 'netherrack', 'gravel', 'andesite', 'diorite', 'granite'];
        this.isProcessing = false;
    }

    get bot() { return this.botCore.bot; }

    /**
     * Dynamic trash detection based on progression
     */
    getTrashItems() {
        const trash = [...this.baseTrash];
        const items = this.bot.inventory.items();

        // If we have better pickaxes, old ones are trash
        const hasDiamondPick = items.some(i => i.name === 'diamond_pickaxe');
        const hasIronPick = items.some(i => i.name === 'iron_pickaxe');

        if (hasDiamondPick) {
            trash.push('wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe');
        } else if (hasIronPick) {
            trash.push('wooden_pickaxe', 'stone_pickaxe');
        }

        // If we have too much cobblestone, it's trash
        const cobbleCount = items.filter(i => i.name === 'cobblestone').reduce((s, i) => s + i.count, 0);
        if (cobbleCount > 128) trash.push('cobblestone');

        return trash;
    }

    /**
     * Auto-craft essential tools if missing
     */
    async autoCraftTools() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const items = this.bot.inventory.items();
            const hasPickaxe = items.some(i => i.name.includes('pickaxe'));
            const hasSword = items.some(i => i.name.includes('sword'));
            const hasAxe = items.some(i => i.name.includes('_axe') && !i.name.includes('pickaxe'));

            // Count materials
            const cobble = items.filter(i => i.name === 'cobblestone').reduce((s, i) => s + i.count, 0);
            const planks = items.filter(i => i.name.includes('planks')).reduce((s, i) => s + i.count, 0);
            const sticks = items.filter(i => i.name === 'stick').reduce((s, i) => s + i.count, 0);

            // Craft sticks if needed
            if (sticks < 4 && planks >= 2) {
                console.log("[Inventory] Crafting sticks...");
                await this.safeCraft('stick', 4);
            }

            // Craft pickaxe if missing
            if (!hasPickaxe && cobble >= 3 && sticks >= 2) {
                console.log("[Inventory] Crafting stone pickaxe...");
                await this.safeCraft('stone_pickaxe', 1);
            } else if (!hasPickaxe && planks >= 3 && sticks >= 2) {
                console.log("[Inventory] Crafting wooden pickaxe...");
                await this.safeCraft('wooden_pickaxe', 1);
            }

            // Craft sword if missing
            if (!hasSword && cobble >= 2 && sticks >= 1) {
                console.log("[Inventory] Crafting stone sword...");
                await this.safeCraft('stone_sword', 1);
            }
        } catch (e) {
            console.warn("[Inventory] Auto-craft failed:", e.message);
        } finally {
            this.isProcessing = false;
        }
    }

    async safeCraft(itemName, count) {
        try {
            if (this.botCore.behaviors?.craft_item) {
                await this.botCore.behaviors.craft_item(itemName, count);
            }
        } catch (e) {
            console.warn(`[Inventory] Craft ${itemName} failed:`, e.message);
        }
    }

    /**
     * Emergency dump when inventory is nearly full
     */
    async emergencyDump() {
        if (this.bot.inventory.emptySlotCount() > 3) return;

        console.log("[Inventory] Emergency dump - inventory nearly full!");
        const trashItems = this.getTrashItems();
        const items = this.bot.inventory.items();

        // Sort by priority (trash first, then excess stone)
        const toDrop = items.filter(i => trashItems.includes(i.name));

        for (const item of toDrop.slice(0, 5)) { // Drop max 5 stacks
            try {
                await this.bot.tossStack(item);
                await new Promise(r => setTimeout(r, 200));
                console.log(`[Inventory] Dropped ${item.count}x ${item.name}`);
                if (this.bot.inventory.emptySlotCount() > 5) break;
            } catch (e) { /* ignore */ }
        }
    }

    async autoCompacting() {
        const items = this.bot.inventory.items();
        const compactibles = {
            'iron_ingot': 'iron_block',
            'gold_ingot': 'gold_block',
            'diamond': 'diamond_block',
            'emerald': 'emerald_block',
            'raw_iron': 'iron_block', // Needs smelting first usually, but auto-compacting raw is safer
            'coal': 'coal_block'
        };

        for (const [raw, block] of Object.entries(compactibles)) {
            const itemCount = items.filter(i => i.name === raw).reduce((sum, i) => sum + i.count, 0);
            if (itemCount >= 9) {
                console.log(`[Inventory] Compacting ${raw} into ${block}...`);
                try {
                    // Use behaviors wrapper if available, or raw bot craft
                    await this.botCore.behaviors.craft_item(block, Math.floor(itemCount / 9));
                } catch (err) {
                    console.log(`[Inventory] Failed to compact ${raw}: ${err.message}`);
                }
            }
        }
    }

    async autoDump() {
        if (this.bot.inventory.emptySlotCount() > 2) return;

        console.log("[Inventory] Dumping trash...");
        const trashItems = this.getTrashItems();
        const items = this.bot.inventory.items();
        for (const item of items) {
            if (trashItems.includes(item.name)) {
                await this.bot.tossStack(item);
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }
}

module.exports = InventoryManager;
