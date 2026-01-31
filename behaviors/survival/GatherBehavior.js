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

        // 0. Check Inventory Full & Manage Trash
        if (this.bot.inventory.emptySlotCount() === 0) {
            console.warn("[Gather] ⚠️ Inventory is FULL. Attempting to clear trash...");
            const cleared = await this.manageTrash();
            if (!cleared) {
                console.warn("[Gather] ❌ Inventory still full after trash clear. Cannot gather.");
                return false;
            }
        }

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
                // 2. Equip Best Tool (with durability check)
                // Note: bot.tool.equipForBlock automatically tries to pick best tool, but doesn't check low durability by default unless configured.
                // We add a manual check here if possible or just rely on standard equip.
                // Better safety:
                // Better safety:
                const tool = this.bot.pathfinder.bestHarvestTool(block);

                // PHASE 6: Crafting Fallback
                if (!tool) {
                    console.warn(`[Gather] No tool found for ${block.name}. Checking craftables...`);
                    // Lazy load crafting manager if available in botCore? or separate?
                    // Assuming botCore has crafting behavior or we need to instantiate.
                    // Ideally check botCore.behaviors.crafting? 
                    // For now, simpler check: Do we have materials?
                    // Since we don't have a global 'craftingManager' instance easily exposed here without refactor,
                    // We will just log for now as 'Plan' said "Inject CraftingManager".

                    // TODO: Full Crafting Manager integration requires dependency injection update.
                    // Fallback: Continue hand mining if possible, or abort.
                    if (!block.harvestTools) {
                        // Hand mineable
                    } else {
                        console.warn(`[Gather] ❌ Need tool for ${block.name}, cannot craft yet.`);
                        continue;
                    }
                }

                if (tool && (tool.maxDurability - tool.durabilityUsed) < 10) {
                    console.warn(`[Gather] ⚠️ Tool ${tool.name} is about to break! (Durability < 10). Skipping to avoid breaking it.`);
                    continue;
                }

                await this.bot.tool.equipForBlock(block, {});

                // 3. Move to block
                await this.bot.pathfinder.goto(new GoalBlock(block.position.x, block.position.y, block.position.z));

                // 3.5. Re-check block existence (Race Condition Fix)
                const targetBlock = this.bot.blockAt(block.position);
                if (!targetBlock || targetBlock.name !== block.name) {
                    console.log(`[Gather] Block ${resourceName} at ${block.position} is gone or changed!`);
                    continue;
                }

                // 4. Mine
                await this.bot.dig(targetBlock); // Use fresh block reference
                gathered++;
            } catch (err) {
                console.log(`[Gather] Error mining ${resourceName}: ${err.message}`);
                continue; // Try next block
            }
        }

        return gathered > 0;
    }

    async manageTrash() {
        const TRASH_ITEMS = [
            'dirt', 'cobblestone', 'diorite', 'granite', 'andesite',
            'netherrack', 'gravel', 'sand', 'rotten_flesh', 'spider_eye', 'bone',
            'poisonous_potato', 'wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds', 'sapling', 'bamboo'
        ];

        // Items we NEVER toss (safeguard)
        const SAFE_ITEMS = ['diamond', 'iron_ingot', 'gold_ingot', 'coal', 'bread', 'cooked_beef'];

        const items = this.bot.inventory.items();
        let clearedSomething = false;

        for (const item of items) {
            // Basic partial match for saplings/seeds
            const isTrash = TRASH_ITEMS.includes(item.name) ||
                (item.name.includes('seed') && !['wheat', 'carrot', 'potato'].includes(item.name)) ||
                item.name.includes('sapling');

            if (isTrash && !SAFE_ITEMS.includes(item.name)) {
                try {
                    console.log(`[Gather] 🗑️ Tossing trash: ${item.name} x${item.count}`);

                    // Look down to avoid auto-pickup
                    await this.bot.look(this.bot.entity.yaw, -Math.PI / 2, true);

                    await this.bot.toss(item.type, null, item.count);
                    clearedSomething = true;

                    // Optimization: Wait a bit to sync inventory & avoid spam kick
                    await new Promise(r => setTimeout(r, 600));

                } catch (e) {
                    console.error(`[Gather] Error tossing ${item.name}:`, e);
                }
            }
        }

        // Reset look
        // await this.bot.look(this.bot.entity.yaw, 0);

        return clearedSomething || this.bot.inventory.emptySlotCount() > 0;
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

        // Phase 7 Optimization: Remove Spiral Search Loop (Redundant)
        // mineflayer findBlocks already returns nearest blocks first.
        // Single optimized query covers the area efficiently.

        const found = this.bot.findBlocks({
            matching: blockId,
            maxDistance: this.maxSearchDistance,
            count: count
        });

        if (found.length > 0) return found;

        return [];
    }
}

module.exports = GatherBehavior;
