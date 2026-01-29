/**
 * StripMiner.js - Strip Mining Behavior
 * 
 * FIX: Sequential pathfinder calls with await (not 100 instant calls)
 * FIX: Trash dumping when inventory is full
 */
const { goals } = require('mineflayer-pathfinder');

class StripMiner {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        // Trash blocks to dump when inventory is full
        this.trashBlocks = [
            'cobblestone', 'cobbled_deepslate', 'dirt', 'gravel',
            'diorite', 'granite', 'andesite', 'netherrack', 'tuff'
        ];
    }

    async startStripMining() {
        const TARGET_Y = -58; // Deepslate Diamond Level
        console.log("[Mining] Starting Strip Mine operation...");

        // 1. Dig down to target level (if needed)
        if (this.bot.entity.position.y > TARGET_Y) {
            console.log(`[Mining] Digging down from Y=${Math.floor(this.bot.entity.position.y)} to ${TARGET_Y}`);
            try {
                const goal = new goals.GoalY(TARGET_Y);
                await this.bot.pathfinder.goto(goal);
            } catch (e) {
                console.log("[Mining] Failed to reach target depth:", e.message);
                return;
            }
        }

        // 2. Start Branch Mining
        console.log("[Mining] At target depth. Starting branch mining.");
        const startPos = this.bot.entity.position.clone();

        // Calculate direction based on yaw (simplified: just go +X)
        const direction = { x: 1, z: 0 };

        for (let i = 0; i < 50; i++) { // Mine 50 blocks forward
            // FIX 1: Check inventory and dump trash BEFORE mining
            if (this.bot.inventory.emptySlotCount() < 3) {
                console.log("[Mining] Inventory nearly full. Dumping trash...");
                await this.dumpTrash();

                // If still full after dumping, stop mining
                if (this.bot.inventory.emptySlotCount() < 2) {
                    console.log("[Mining] Inventory still full with valuables. Returning to base.");
                    return;
                }
            }

            // FIX 2: Use AWAIT with pathfinder.goto() - sequential, not instant spam
            try {
                const nextX = Math.floor(startPos.x) + (i * direction.x);
                const nextZ = Math.floor(startPos.z) + (i * direction.z);
                const y = Math.floor(startPos.y);

                // Go to next position
                const goal = new goals.GoalBlock(nextX, y, nextZ);
                await this.bot.pathfinder.goto(goal);

                // Dig ceiling block to make 2-high tunnel
                const ceilingPos = this.bot.entity.position.offset(0, 2, 0);
                const ceilingBlock = this.bot.blockAt(ceilingPos);
                if (ceilingBlock && ceilingBlock.name !== 'air' && ceilingBlock.name !== 'cave_air') {
                    await this.bot.dig(ceilingBlock);
                }

                // Small delay to prevent overwhelming the server
                await new Promise(r => setTimeout(r, 100));

            } catch (e) {
                console.log("[Mining] Segment blocked or finished:", e.message);
                break;
            }
        }

        console.log("[Mining] Strip mining session complete.");
    }

    /**
     * Dump trash blocks (cobblestone, dirt, gravel, etc.)
     */
    async dumpTrash() {
        const items = this.bot.inventory.items();

        for (const item of items) {
            const isTrash = this.trashBlocks.some(trash => item.name.includes(trash));
            if (isTrash) {
                try {
                    await this.bot.tossStack(item);
                    // Delay between tosses to prevent packet spam
                    await new Promise(r => setTimeout(r, 300));
                } catch (e) {
                    // Ignore toss errors
                }
            }
        }

        console.log(`[Mining] Trash dumped. Empty slots: ${this.bot.inventory.emptySlotCount()}`);
    }

    async digDown(targetY) {
        // Staircase logic for safe descent
        console.log("[Mining] Using pathfinder to descend safely.");
        try {
            const current = this.bot.entity.position;
            const goal = new goals.GoalY(targetY);
            await this.bot.pathfinder.goto(goal);
        } catch (err) {
            console.log("[Mining] Error digging down:", err.message);
        }
    }
}

module.exports = StripMiner;
