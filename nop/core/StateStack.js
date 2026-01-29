class StateStack {
    constructor(botCore) {
        this.botCore = botCore;
        this.stack = [];
        this.active = false;
    }

    push(stateName, context = {}) {
        console.log(`[StateStack] Pushing State: ${stateName}`);

        // Save current "Main Task" context if stack was empty (Main -> Reflex)
        if (this.stack.length === 0) {
            this.savedMainGoal = this.botCore.survivalSystem.currentGoal;
            this.botCore.pathfinder.setGoal(null); // Pause current movement
        }

        this.stack.push({ name: stateName, context, startTime: Date.now() });
        this.active = true;
    }

    pop() {
        if (this.stack.length === 0) return;

        const finished = this.stack.pop();
        console.log(`[StateStack] Popped State: ${finished.name}`);

        if (this.stack.length > 0) {
            // Resume previous reflex? (Nested reflexes not essential for MVP, but kept structure)
            const prev = this.stack[this.stack.length - 1];
            console.log(`[StateStack] Resuming nested state: ${prev.name}`);
        } else {
            // Stack empty -> Resume Main Task
            this.active = false;
            console.log(`[StateStack] Resuming Main Goal: ${this.savedMainGoal}`);

            // Force GoalArbitrator to re-evaluate or resume
            if (this.botCore.survivalSystem) {
                this.botCore.survivalSystem.executeGoal(this.savedMainGoal);
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
