class InventoryManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.trashItems = ['cobblestone', 'dirt', 'netherrack', 'gravel', 'andesite', 'diorite', 'granite'];
    }

    get bot() { return this.botCore.bot; }

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
        const items = this.bot.inventory.items();
        for (const item of items) {
            if (this.trashItems.includes(item.name)) {
                await this.bot.tossStack(item);
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }
}

module.exports = InventoryManager;
