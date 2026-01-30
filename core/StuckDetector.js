/**
 * StuckDetector.js - Position Monitoring & Auto-Unstick
 * Detects when bot is stuck and attempts recovery actions.
 */

class StuckDetector {
    constructor(botCore) {
        this.botCore = botCore;
        this.interval = null;

        // State tracking
        this.lastPosition = null;
        this.stuckTime = 0;
        this.stuckThreshold = 10000;  // 10 seconds of no movement = stuck
        this.checkInterval = 3000;    // Check every 3 seconds
        this.isUnsticking = false;
    }

    get bot() { return this.botCore.bot; }

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => this.tick(), this.checkInterval);
        console.log("[StuckDetector] Started position monitoring");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    tick() {
        if (!this.bot || !this.botCore.isInitialized) return;
        if (this.isUnsticking) return;

        // FIX: Do not trigger stuck detection while mining (digging takes time)
        if (this.bot.targetDigBlock) return;

        // Only check if bot is supposed to be moving
        const isMoving = this.bot.pathfinder?.goal !== null ||
            this.bot.controlState.forward ||
            this.bot.controlState.back;

        if (!isMoving) {
            this.resetState();
            return;
        }

        const currentPos = this.bot.entity.position.clone();

        if (this.lastPosition) {
            const distance = currentPos.distanceTo(this.lastPosition);

            if (distance < 0.5) {
                // Hasn't moved
                this.stuckTime += this.checkInterval;
                console.log(`[StuckDetector] No movement for ${this.stuckTime}ms...`);

                if (this.stuckTime >= this.stuckThreshold) {
                    this.handleStuck();
                }
            } else {
                // Moving fine
                this.resetState();
            }
        }

        this.lastPosition = currentPos;
    }

    resetState() {
        this.stuckTime = 0;
    }

    async handleStuck() {
        if (this.isUnsticking) return;
        this.isUnsticking = true;
        console.log("[StuckDetector] STUCK! Attempting recovery...");

        try {
            // Strategy 1: Jump
            console.log("[StuckDetector] Trying jump...");
            this.bot.setControlState('jump', true);
            await this.sleep(500);
            this.bot.setControlState('jump', false);
            await this.sleep(500);

            // Check if fixed
            if (await this.checkIfMoved()) {
                console.log("[StuckDetector] Jump worked!");
                this.resetState();
                return;
            }

            // Strategy 2: Turn around
            console.log("[StuckDetector] Trying turn around...");
            await this.bot.look(this.bot.entity.yaw + Math.PI, 0);
            this.bot.setControlState('forward', true);
            await this.sleep(1000);
            this.bot.setControlState('forward', false);

            if (await this.checkIfMoved()) {
                console.log("[StuckDetector] Turn around worked!");
                this.resetState();
                return;
            }

            // Strategy 3: Break block in front
            console.log("[StuckDetector] Trying to break blocking block...");
            await this.breakBlockingBlock();

            if (await this.checkIfMoved()) {
                console.log("[StuckDetector] Breaking block worked!");
                this.resetState();
                return;
            }

            // Strategy 4: Random pathfind
            console.log("[StuckDetector] Trying random reposition...");
            await this.randomReposition();

        } catch (e) {
            console.warn("[StuckDetector] Recovery error:", e.message);
        } finally {
            this.isUnsticking = false;
            this.resetState();
        }
    }

    async checkIfMoved() {
        const before = this.bot.entity.position.clone();
        await this.sleep(1000);
        const after = this.bot.entity.position.clone();
        return before.distanceTo(after) > 1;
    }

    async breakBlockingBlock() {
        // Get block in front at eye level
        const dir = this.bot.entity.position.offset(
            Math.sin(this.bot.entity.yaw) * -1,
            1,
            Math.cos(this.bot.entity.yaw) * -1
        ).floored();

        const block = this.bot.blockAt(dir);
        if (block && block.name !== 'air' && block.name !== 'bedrock') {
            try {
                await this.bot.dig(block);
            } catch (e) {
                // Try block at feet level instead
                const blockFeet = this.bot.blockAt(dir.offset(0, -1, 0));
                if (blockFeet && blockFeet.name !== 'air') {
                    await this.bot.dig(blockFeet);
                }
            }
        }
    }

    async randomReposition() {
        const { goals } = require('mineflayer-pathfinder');
        const offset = {
            x: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10
        };
        const target = this.bot.entity.position.offset(offset.x, 0, offset.z);

        try {
            this.bot.pathfinder.setGoal(new goals.GoalNear(target.x, target.y, target.z, 2), true);
            await this.sleep(3000);
            this.bot.pathfinder.stop();
        } catch (e) { /* ignore */ }
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

module.exports = StuckDetector;
