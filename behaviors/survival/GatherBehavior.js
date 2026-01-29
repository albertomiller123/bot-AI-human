const { goals } = require('mineflayer-pathfinder');
const { GoalBlock, GoalNear } = goals;

class GatherBehavior {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.mcData = null; // Defer init
        // Configurable search range (default 128, was 64)
        this.maxSearchDistance = botCore.config?.gather?.maxDistance || 128;
    }

    async gatherResource(resourceName, count = 1) {
        console.log(`[Gather] Starting to gather ${count} ${resourceName} (range: ${this.maxSearchDistance})...`);

        // 1. Identify block type
        const blocks = this.findBlocks(resourceName, count);
        if (blocks.length === 0) {
            console.log(`[Gather] Could not find ${resourceName} within ${this.maxSearchDistance} blocks.`);
            return false;
        }

        let gathered = 0;
        for (const blockPoint of blocks) {
            if (gathered >= count) break;

            // Re-check block existence (it might have been mined)
            const block = this.bot.blockAt(blockPoint);
            if (!block || block.name !== resourceName && !block.name.includes(resourceName.replace('_log', ''))) continue;

            try {
                // 2. Equip Best Tool
                await this.bot.tool.equipForBlock(block, {});

                // 3. Move to block
                await this.bot.pathfinder.goto(new GoalBlock(block.position.x, block.position.y, block.position.z));

                // 4. Mine
                await this.bot.dig(block);
                gathered++;
            } catch (err) {
                console.log(`[Gather] Error mining ${resourceName}: ${err.message}`);
                continue; // Try next block
            }
        }

        return gathered > 0;
    }

    findBlocks(name, count) {
        if (!this.mcData && this.bot && this.bot.version) {
            this.mcData = require('minecraft-data')(this.bot.version);
        }
        if (!this.mcData) return [];

        // Map common names to ids if needed, or use tag matching
        const blockId = this.mcData.blocksByName[name]?.id;
        if (!blockId && name === 'wood') {
            // Special case for any log
            const logs = [
                this.mcData.blocksByName['oak_log']?.id,
                this.mcData.blocksByName['birch_log']?.id,
                this.mcData.blocksByName['spruce_log']?.id,
                this.mcData.blocksByName['jungle_log']?.id,
                this.mcData.blocksByName['acacia_log']?.id,
                this.mcData.blocksByName['dark_oak_log']?.id
            ].filter(Boolean); // Remove undefined entries

            return this.bot.findBlocks({
                matching: logs,
                maxDistance: this.maxSearchDistance,
                count: count * 2
            });
        }

        return this.bot.findBlocks({
            matching: blockId,
            maxDistance: this.maxSearchDistance,
            count: count
        });
    }
}

module.exports = GatherBehavior;
