class StateStack {
    constructor(botCore) {
        this.botCore = botCore;
        this.stack = [];
        this.active = false;
    }

    push(stateName, context = {}) {
        console.log(`[StateStack] Pushing State: ${stateName}`);

        // Lock GoalManager to prevent it from interfering with Reflex
        if (this.botCore.goalManager) {
            this.botCore.goalManager.lock();
        }

        this.stack.push({ name: stateName, context, startTime: Date.now() });
        this.active = true;
    }

    pop() {
        if (this.stack.length === 0) return;

        const finished = this.stack.pop();
        console.log(`[StateStack] Popped State: ${finished.name}`);

        if (this.stack.length === 0) {
            // Stack empty -> Resume Main Task via GoalManager
            this.active = false;

            // CRITICAL FIX: Release control to GoalManager
            // GoalManager will see bot is free and pick best goal in next tick()
            if (this.botCore.goalManager) {
                console.log("[StateStack] Releasing control to GoalManager");
                this.botCore.goalManager.unlock();
            }
        }
    }

    clear() {
        this.stack = [];
        this.active = false;
        console.log("[StateStack] Cleared.");
    }

    getCurrent() {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }
}

module.exports = StateStack;
