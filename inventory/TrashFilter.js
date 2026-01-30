class TrashFilter {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        this.junkItems = new Set([
            'wheat_seeds',
            'rotten_flesh',
            'spider_eye',
            'poisonous_potato',
            'dirt',
            'cobblestone', // Warning: Context dependent, but usually junk in late game
            'gravel',
            'diorite',
            'andesite',
            'granite'
        ]);

        this.keepThreshold = {
            'dirt': 64, // Keep 1 stack
            'cobblestone': 64,
            'wheat_seeds': 16
        };
    }

    async cleanInventory() {
        if (!this.bot) return;

        console.log("[TrashFilter] Scanning inventory for junk...");
        const items = this.bot.inventory.items();

        for (const item of items) {
            if (this.junkItems.has(item.name)) {
                // Check threshold
                const threshold = this.keepThreshold[item.name] || 0;

                // If we have more than threshold, drop the excess
                // This logic is tricky because `items()` returns slots, not aggregated counts.
                // We need to count total first.

                // Simplified: Just drop if in junk list and we don't need it?
                // Better: Count first.
            }
        }

        // Aggregated check
        const counts = {};
        for (const item of items) {
            counts[item.name] = (counts[item.name] || 0) + item.count;
        }

        for (const item of items) {
            if (this.junkItems.has(item.name)) {
                const limit = this.keepThreshold[item.name] || 0;
                const currentTotal = counts[item.name];

                if (currentTotal > limit) {
                    // Drop this item stack
                    // Update count
                    try {
                        await this.bot.tossStack(item);
                        console.log(`[TrashFilter] Tossed ${item.name} x${item.count}`);
                        counts[item.name] -= item.count;
                        await new Promise(r => setTimeout(r, 500)); // Delay
                    } catch (e) {
                        console.error(`[TrashFilter] Failed to toss ${item.name}:`, e.message);
                    }
                }
            }
        }
    }
}

module.exports = TrashFilter;
