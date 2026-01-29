// coordinator.js (Layer 3: Coordinator & Passive AI)
const { v4: uuidv4 } = require('uuid');
const Humanizer = require('./humanizer');

class Coordinator {
    constructor(botCore) {
        this.botCore = botCore;
        this.currentTask = null; // { id, command, params, status, behaviorName }
    }

    get bot() { return this.botCore.bot; }
    get behaviors() { return this.botCore.behaviors; }
    get primitives() { return this.botCore.primitives; }

    // --- EXECUTION COORDINATION ---

    async execute_command(behaviorName, params) {
        if (this.currentTask && this.currentTask.status === 'running') {
            throw new Error("Bot is busy. Use cancel_action() first.");
        }

        if (typeof this.behaviors[behaviorName] !== 'function') {
            throw new Error(`Unknown behavior: ${behaviorName}`);
        }

        this.currentTask = {
            id: uuidv4(),
            behaviorName,
            params,
            status: 'running',
            startTimestamp: Date.now()
        };

        this.report_status("STARTED");
        this.save_state();

        try {
            await this.behaviors[behaviorName](...Object.values(params));

            this.currentTask.status = 'completed';
            this.report_status("COMPLETED");
            this.log_history(`Completed: ${behaviorName}`, params); // Log success
            this.clear_state();

        } catch (error) {
            this.currentTask.status = 'failed';
            this.currentTask.error = error.message;
            this.report_error(error);
            this.explain_failure();
            this.log_history(`Failed: ${behaviorName} (${error.message})`, params); // Log failure
            this.save_state();
        }
    }

    async cancel_action() {
        if (!this.currentTask || this.currentTask.status !== 'running') {
            console.log("[Coordinator] Nothing to cancel.");
            return;
        }

        await this.primitives.stop();

        this.currentTask.status = 'cancelled';
        this.report_status("CANCELLED");
        this.clear_state();
    }

    async resume_action() {
        const state = await this.load_state();
        if (!state || !state.behaviorName) {
            console.log("[Coordinator] No previous state to resume.");
            return;
        }

        console.log(`[Coordinator] Resuming task: ${state.behaviorName}...`);

        this.currentTask = state;
        this.currentTask.status = 'running';

        try {
            await this.behaviors[state.behaviorName](...Object.values(state.params));

            this.currentTask.status = 'completed';
            this.report_status("COMPLETED");
            this.clear_state();

        } catch (error) {
            this.currentTask.status = 'failed';
            this.currentTask.error = error.message;
            this.report_error(error);
            this.explain_failure();
            this.save_state();
        }
    }

    // --- CHECK & REPORT ---

    async validate_condition(conditionFn) {
        try {
            const result = await conditionFn();
            if (!result) throw new Error("Condition check failed.");
            return true;
        } catch (e) {
            this.report_error(e);
            return false;
        }
    }

    report_status(status) {
        const taskName = this.currentTask ? this.currentTask.behaviorName : "None";
        console.log(`[STATUS] Task: ${taskName} | State: ${status}`);
    }

    report_error(error) {
        console.error(`[ERROR] ${error.message}`);
    }

    explain_failure() {
        if (!this.currentTask || !this.currentTask.error) return;

        const error = this.currentTask.error;
        let explanation = "Unknown error.";

        if (error.includes("Inventory full")) explanation = "I need to empty my inventory.";
        if (error.includes("No tool")) explanation = "I lack the required tools.";
        if (error.includes("Missing material")) explanation = "I ran out of materials.";

        console.log(`[EXPLANATION] ${explanation}`);
    }

    // --- SHORT-TERM MEMORY (STATE) ---

    async save_state() {
        if (!this.currentTask) return;
        // SQLite doesn't need "save state" file. We can use a dedicated table or just skip if persistence isn't critical for crash recovery yet.
        // For Phase 3, we skipped creating a "task_state" table in MemoryManager, so let's skip this for now or just log it.
        // Or better: Use MemoryManager.setLTM as a temporary key-value store?
        // Let's implement a simple kv store logic in MemoryManager later if needed.
        // For now, we'll verify if MemoryManager handles this.
        // Actually, MemoryManager.setLTM IS a key-value store in SQLite: "INSERT OR REPLACE INTO long_term..."
        await this.botCore.memory.setLTM('resume_state', this.currentTask);
    }

    async load_state() {
        return await this.botCore.memory.getLTM('resume_state');
    }

    async clear_state() {
        await this.botCore.memory.setLTM('resume_state', null);
        this.currentTask = null;
    }

    // --- TIER 3: SOCIAL & TRIAGE ---

    async start_human_task(behaviorName, params) {
        // Wrapper for execute_command that adds human delay & potential error
        await Humanizer.hesitate(1); // Think before acting

        if (Humanizer.should_make_mistake()) {
            this.botCore.say("chet lia tay roi...");
            await Humanizer.hesitate(2);
        }

        return this.execute_command(behaviorName, params);
    }

    async send_chat(message) {
        // Log outgoing chat
        this.log_chat("Me", message);

        // Humanize
        const humanCheck = Humanizer.humanize_chat(message);

        await Humanizer.random_delay(500, 2000 + message.length * 50); // Type delay based on length
        this.botCore.say(humanCheck);
    }

    // --- MEMORY LOGGING ---

    log_history(action, params) {
        // Use proper SQL history table
        this.botCore.memory.logAction(action, params);
    }

    log_chat(sender, message) {
        // Use SQLite chat logging
        this.botCore.memory.logChat(sender, message);
    }

    async fake_afk(seconds) {
        await Humanizer.fake_afk(this.botCore, seconds);
    }

    async look_at_player(name) {
        const player = this.botCore.bot.players[name]?.entity;
        if (player) {
            await this.botCore.primitives.look_at(player.position.offset(0, 1.6, 0));
        }
    }

    // --- AUTONOMOUS REACTIONS ---

    async start_autonomous_behaviors() {
        // React to damage
        this.bot.on('health', () => this.react_to_damage());

        // Fidget loop (WASD spam)
        setInterval(() => {
            if (this.currentTask === null) {
                // Only fidget if idle
                if (Math.random() < 0.2) this.botCore.primitives.fidget();
            }
        }, 2000);
    }

    async react_to_damage() {
        if (this.bot.health < 20) {
            const attacker = this.bot.nearestEntity(e => e.type === 'player' && e.position.distanceTo(this.bot.entity.position) < 5);
            if (attacker) {
                this.start_chase_routine(attacker);
            }
        }
    }

    async start_chase_routine(target) {
        if (this.isAngry) return; // Already chasing
        this.isAngry = true;
        this.botCore.say("may chet voi bo");

        const chaseLoop = setInterval(async () => {
            if (!this.isAngry || !target || !target.isValid) {
                clearInterval(chaseLoop);
                this.isAngry = false;
                return;
            }

            // Check Forgive
            if (Math.random() < 0.1) { // 10% chance
                this.botCore.say("tha cho may lan nay");
                this.isAngry = false;
                clearInterval(chaseLoop);
                await this.primitives.stop();
                return;
            }

            // Chase behavior: Move to target
            await this.primitives.look_at(target.position.offset(0, 1.6, 0));
            this.bot.setControlState('sprint', true);
            this.bot.setControlState('forward', true);
            if (this.bot.entity.isCollidedHorizontally) this.bot.setControlState('jump', true);

        }, 500); // Update every 500ms

        // Timeout after 30s?
        setTimeout(() => {
            if (this.isAngry) {
                this.isAngry = false;
                clearInterval(chaseLoop);
                this.primitives.stop();
                this.botCore.say("chay nhanh the");
            }
        }, 30000);
    }

    async remember_location(name) {
        const pos = this.bot.entity.position;
        // Use proper SQL table
        await this.botCore.memory.saveLocation(name, {
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            z: Math.round(pos.z)
        });
        // Update cache
        this.botCore.locationsCache[name] = pos;
        console.log(`[Coordinator] da nho vi tri: ${name}`);
    }
}

module.exports = Coordinator;
