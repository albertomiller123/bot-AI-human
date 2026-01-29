class Watchdog {
    constructor(botCore, survivalSystem) {
        this.botCore = botCore;
        this.survival = survivalSystem;

        this.lastPosition = null;
        this.lastMoveTime = Date.now();
        this.stuckThreshold = 15000; // 15 seconds stuck = Reset
        this.checkInterval = 1000;

        this.isMonitoring = false;
    }

    start() {
        if (!this.botCore.bot || !this.botCore.bot.entity) {
            console.log("[Watchdog] Bot not ready, delaying start...");
            setTimeout(() => this.start(), 1000);
            return;
        }

        this.isMonitoring = true;
        this.lastPosition = this.botCore.bot.entity.position.clone();

        setInterval(() => this.tick(), this.checkInterval);
        console.log("[Watchdog] Started. Watching for freeze...");
    }

    tick() {
        // Don't run if bot is disconnected
        if (!this.botCore.isInitialized) return;
        if (!this.isMonitoring || !this.botCore.bot?.entity) return;

        const currentPos = this.botCore.bot.entity.position;
        const taskName = this.survival.currentGoal || "Idle";

        // Ignore if Idle (being still is okay)
        if (taskName.toLowerCase() === 'idle' && this.survival.stateStack && !this.survival.stateStack.active) {
            this.lastMoveTime = Date.now(); // Reset timer
            this.lastPosition = currentPos.clone();
            return;
        }

        // Check distance moved
        if (this.lastPosition.distanceTo(currentPos) > 0.5) {
            // Moved successfully implies not stuck
            this.lastMoveTime = Date.now();
            this.lastPosition = currentPos.clone();
        } else {
            // Not moving
            if (Date.now() - this.lastMoveTime > this.stuckThreshold) {
                this.triggerReset(taskName);
            }
        }
    }

    activeAction() {
        // Call this when bot performs an action (block place, eat) to reset timer
        // Acting without moving is valid (e.g. crafting)
        this.lastMoveTime = Date.now();
    }

    triggerReset(taskName) {
        console.warn(`[Watchdog] ⚠️ BOT FROZEN DETECTED (Task: ${taskName}) ⚠️`);
        console.warn(`[Watchdog] Executing Anti-Freeze Protocol...`);

        // 1. Hard Stop
        this.botCore.bot.clearControlStates();
        if (this.botCore.bot && this.botCore.bot.pathfinder) {
            this.botCore.bot.pathfinder.setGoal(null);
        }

        // 2. Clear State Stack (Reflex might have bugged)
        if (this.survival.stateStack) this.survival.stateStack.clear();

        // 3. Jump/Swing arm (Physical unstuck)
        this.botCore.bot.setControlState('jump', true);
        this.botCore.bot.swingArm();
        setTimeout(() => this.botCore.bot.setControlState('jump', false), 500);

        // 4. Force Re-Evaluate Goals
        this.lastMoveTime = Date.now(); // Reset timer to prevent double trigger

        setTimeout(() => {
            console.log("[Watchdog] Rebooting Decision Engine...");
            this.survival.currentGoal = null; // Force null so evaluate() picks a new one
        }, 1000);
    }
}

module.exports = Watchdog;
