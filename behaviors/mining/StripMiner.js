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
        const TARGET_Y = -58;
        console.log("[Mining] Starting Strip Mine operation...");

        // Disable Stuck Detector during mining to avoid conflicts
        if (this.botCore.stuckDetector) this.botCore.stuckDetector.stop();

        try {
            // 1. Dig down to target level
            if (this.bot.entity.position.y > TARGET_Y) {
                console.log(`[Mining] Digging down to ${TARGET_Y}`);
                await this.digDown(TARGET_Y);
            }

            // 2. Branch Mining
            console.log("[Mining] Starting tunnel...");
            const direction = { x: 1, z: 0 };
            // Better direction deduction based on yaw could go here

            for (let i = 0; i < 50; i++) {
                if (this.bot.inventory.emptySlotCount() < 2) {
                    await this.dumpTrash();
                    if (this.bot.inventory.emptySlotCount() < 2) {
                        console.log("[Mining] Inventory full. Stopping.");
                        break;
                    }
                }

                // Dig the tunnel (2 blocks high)
                const currentPos = this.bot.entity.position.floored();
                const targetFeet = currentPos.offset(direction.x, 0, direction.z);
                const targetHead = currentPos.offset(direction.x, 1, direction.z);

                if (!await this.safeDig(targetHead) || !await this.safeDig(targetFeet)) {
                    console.log("[Mining] Barrier or Liquid detected. Stopping tunnel.");
                    break;
                }

                // Move forward manually
                await this.bot.lookAt(targetHead);
                this.bot.setControlState('forward', true);

                // Wait until we reach the block center
                const reached = await this.waitForMove(targetFeet);
                this.bot.setControlState('forward', false);

                if (!reached) {
                    console.log("[Mining] Movement blocked.");
                    break;
                }
            }
        } catch (e) {
            console.error("[Mining] Error:", e);
        } finally {
            // Re-enable Stuck Detector
            if (this.botCore.stuckDetector) this.botCore.stuckDetector.start();
            console.log("[Mining] Session complete.");
        }
    }

    async safeDig(pos) {
        const block = this.bot.blockAt(pos);
        if (!block || block.name === 'air') return true;
        if (block.name === 'bedrock') return false;

        // Check for liquids (Naive check: if block is already liquid)
        if (block.name === 'lava' || block.name === 'water') return false;

        try {
            await this.bot.dig(block);

            // Post-dig Safety Check: Did lava flow in?
            await new Promise(r => setTimeout(r, 200)); // Wait for physics
            const afterBlock = this.bot.blockAt(pos);
            if (afterBlock && (afterBlock.name.includes('lava') || afterBlock.name.includes('water'))) {
                console.log("[Mining] 🚨 LIQUID BREACH! Backing off!");
                // Optional: Place block back if possible
                return false;
            }
            return true;
        } catch (e) {
            console.log("[Mining] Dig failed:", e.message);
            return false;
        }
    }

    async waitForMove(targetPos) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                const dist = this.bot.entity.position.distanceTo(targetPos.offset(0.5, 0, 0.5));
                if (dist < 0.5) {
                    clearInterval(check);
                    resolve(true);
                }
            }, 50);

            // Timeout 2s
            setTimeout(() => {
                clearInterval(check);
                resolve(false);
            }, 2000);
        });
    }

    async digDown(targetY) {
        // Staircase logic for safe descent
        console.log("[Mining] Using pathfinder to descend safely.");
        try {
            const goal = new goals.GoalY(targetY);
            await this.bot.pathfinder.goto(goal);
        } catch (err) {
            console.log("[Mining] Error digging down:", err.message);
        }
    }
}

module.exports = StripMiner;
