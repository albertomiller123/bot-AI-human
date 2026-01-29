class IdleBehavior {
    constructor(botCore) {
        this.botCore = botCore;
        this.lastActionTime = Date.now();
        this.idleInterval = null;
    }

    get bot() { return this.botCore.bot; }

    start() {
        this.idleInterval = setInterval(() => this.checkIdle(), 10000); // Check every 10s
    }

    async checkIdle() {
        if (this.botCore.taskManager.isBusy) {
            this.lastActionTime = Date.now();
            return;
        }

        // Phase 2: Guard Mode Check
        if (this.botCore.behaviors && this.botCore.behaviors.guard && this.botCore.behaviors.guard.isActive) {
            this.lastActionTime = Date.now(); // Reset idle timer while guarding
            return;
        }

        const idleTime = Date.now() - this.lastActionTime;
        if (idleTime > 30000) { // Idle for 30s
            await this.performIdleTask();
        }
    }

    async performIdleTask() {
        const rand = Math.random();

        if (this.bot.time.timeOfDay > 13000 && this.bot.time.timeOfDay < 23000) {
            console.log("[Idle] It's night, looking for a bed...");
            // Logic to find bed and sleep would go here
            return;
        }

        if (rand < 0.3) {
            console.log("[Idle] Checking nearby chests...");
            const chestId = this.botCore.mcData.blocksByName.chest.id;
            const chest = this.bot.findBlock({ matching: chestId, maxDistance: 10 });
            if (chest) {
                await this.botCore.primitives.move_to(chest.position);
                await this.bot.activateBlock(chest);
                setTimeout(() => this.bot.closeWindow(this.bot.currentWindow), 2000);
            }
        } else if (rand < 0.6) {
            console.log("[Idle] Organizing inventory...");
            if (this.botCore.inventoryManager) {
                await this.botCore.inventoryManager.autoDump();
            }
        } else {
            console.log("[Idle] Just wandering a bit...");
            await this.botCore.primitives.fidget();
        }

        this.lastActionTime = Date.now();
    }

    stop() {
        if (this.idleInterval) clearInterval(this.idleInterval);
    }
}

module.exports = IdleBehavior;
