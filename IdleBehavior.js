class IdleBehavior {
    constructor(botCore) {
        this.botCore = botCore;
        this.lastActionTime = Date.now();
        this.idleInterval = null;
        this.isPerformingTask = false; // Prevent overlapping idle tasks
    }

    get bot() { return this.botCore.bot; }

    start() {
        // Only start if bot is ready
        if (!this.bot || !this.botCore.isInitialized) {
            console.log("[Idle] Deferring start - bot not ready");
            return;
        }
        this.idleInterval = setInterval(() => this.checkIdle(), 10000); // Check every 10s
        console.log("[Idle] Started with safety guards");
    }

    async checkIdle() {
        // Safety: Don't run if bot disconnected or not initialized
        if (!this.bot || !this.botCore.isInitialized) return;

        // Prevent overlapping tasks
        if (this.isPerformingTask) return;

        if (this.botCore.taskManager.isBusy) {
            this.lastActionTime = Date.now();
            return;
        }

        // Phase 2: Guard Mode Check
        if (this.botCore.behaviors?.guard?.isActive) {
            this.lastActionTime = Date.now();
            return;
        }

        const idleTime = Date.now() - this.lastActionTime;
        if (idleTime > 30000) { // Idle for 30s
            await this.performIdleTask();
        }
    }

    async performIdleTask() {
        // Safety: Validate bot state
        if (!this.bot || !this.botCore.isInitialized || !this.botCore.mcData) {
            return;
        }

        this.isPerformingTask = true;

        try {
            const rand = Math.random();

            // Safety: Check bot.time exists
            if (this.bot.time?.timeOfDay > 13000 && this.bot.time?.timeOfDay < 23000) {
                console.log("[Idle] It's night, resting...");
                this.lastActionTime = Date.now();
                return;
            }

            if (rand < 0.3) {
                await this._checkNearbyChests();
            } else if (rand < 0.6) {
                await this._organizeInventory();
            } else {
                await this._wanderSafely();
            }

            this.lastActionTime = Date.now();
        } catch (error) {
            console.warn("[Idle] Task failed safely:", error.message);
        } finally {
            this.isPerformingTask = false;
        }
    }

    async _checkNearbyChests() {
        console.log("[Idle] Checking nearby chests...");

        const chestBlock = this.botCore.mcData?.blocksByName?.chest;
        if (!chestBlock) return;

        const chest = this.bot.findBlock({ matching: chestBlock.id, maxDistance: 10 });
        if (!chest) return;

        try {
            await this.botCore.primitives.move_to(chest.position);

            // Validate block still exists before interacting
            const blockNow = this.bot.blockAt(chest.position);
            if (!blockNow || blockNow.name !== 'chest') return;

            await this.bot.activateBlock(blockNow);
            setTimeout(() => {
                if (this.bot?.currentWindow) {
                    this.bot.closeWindow(this.bot.currentWindow);
                }
            }, 2000);
        } catch (e) {
            console.warn("[Idle] Chest interaction failed:", e.message);
        }
    }

    async _organizeInventory() {
        console.log("[Idle] Organizing inventory...");
        if (this.botCore.inventoryManager) {
            try {
                await this.botCore.inventoryManager.autoDump();
            } catch (e) {
                console.warn("[Idle] Inventory organize failed:", e.message);
            }
        }
    }

    async _wanderSafely() {
        console.log("[Idle] Just wandering a bit...");
        if (this.botCore.primitives?.fidget) {
            try {
                await this.botCore.primitives.fidget();
            } catch (e) {
                console.warn("[Idle] Wander failed:", e.message);
            }
        }
    }

    stop() {
        if (this.idleInterval) {
            clearInterval(this.idleInterval);
            this.idleInterval = null;
        }
        this.isPerformingTask = false;
    }
}

module.exports = IdleBehavior;
