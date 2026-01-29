class ChestTracker {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = null;
        this.memory = botCore.memory;
    }

    start() {
        this.bot = this.botCore.bot;
        this.bot.on('windowOpen', async (window) => {
            // Check if it's a chest or shulker
            if (window.type.includes('chest') || window.type.includes('shulker_box')) {
                const chestPos = this.bot.blockAtCursor(5)?.position;
                if (!chestPos) return;

                console.log(`[ChestTracker] Scanning chest at ${chestPos}...`);
                const items = window.items().map(item => ({
                    name: item.name,
                    count: item.count,
                    slot: item.slot
                }));

                // Use NEW normalized storage for O(1) item lookups
                await this.memory.saveChestItems(chestPos, items);
                console.log(`[ChestTracker] Saved ${items.length} items to normalized database.`);
            }
        });
    }

    // O(1) complexity with indexed SQL query (was O(N) with JSON parsing)
    async findItemInChests(itemName) {
        return this.memory.findItemInChests(itemName);
    }
}

module.exports = ChestTracker;
