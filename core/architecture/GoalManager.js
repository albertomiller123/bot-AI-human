/**
 * GoalManager.js - The Grand Unifier
 * 
 * Arbitrates between biological survival needs and cognitive agent plans.
 * Single Source of Truth for "What is the bot doing right now?".
 */
class GoalManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.activeGoal = null; // { id, source, priority, data, timestamp }
        this.sources = [];
        this.isLocked = false; // If true, prevents goal switching (e.g. during critical combat)
    }

    registerSource(name, callback) {
        this.sources.push({ name, getProposal: callback });
    }

    async tick() {
        if (this.isLocked) return;

        let bestProposal = null;

        // 1. Collect Proposals
        for (const source of this.sources) {
            try {
                const proposal = await source.getProposal();
                if (proposal && (!bestProposal || proposal.priority > bestProposal.priority)) {
                    bestProposal = { ...proposal, source: source.name };
                }
            } catch (e) {
                console.error(`[GoalManager] Error getting proposal from ${source.name}:`, e);
            }
        }

        // 2. Evaluate Winner
        if (!bestProposal) return;

        if (this.activeGoal) {
            // If goal is effectively the same (ID match), ignore to prevent restart loops
            // unless priority increased significantly? No, stuck to same ID is fine.
            if (bestProposal.id === this.activeGoal.id) return;

            // Stickiness: If priority difference is small (<= 5), stick to current goal
            // This prevents rapid oscillating between two similar priority goals
            if (bestProposal.priority <= this.activeGoal.priority + 5) return;
        }

        // 3. Switch Goal (Only runs if we decided to switch)
        await this.setGoal(bestProposal);
    }

    async stopCurrentGoal() {
        if (!this.activeGoal) return;
        console.log(`[GoalManager] 🛑 Stopping: ${this.activeGoal.id}`);

        // Call stop callback if provided
        if (this.activeGoal.stop) {
            try { await this.activeGoal.stop(); } catch (e) {
                console.warn(`[GoalManager] Error stopping goal ${this.activeGoal.id}:`, e);
            }
        }

        // Stop pathfinder if active (global safety)
        if (this.botCore.bot && this.botCore.bot.pathfinder) {
            this.botCore.bot.pathfinder.setGoal(null);
        }

        this.activeGoal = null;
    }

    async setGoal(proposal) {
        // Stop old goal first
        await this.stopCurrentGoal();

        console.log(`[GoalManager] 🔀 Start: [${proposal.id}] (Prio: ${proposal.priority})`);
        this.activeGoal = proposal;

        // CRITICAL FIX: Non-blocking Execution
        // We do NOT await here. We fire and forget.
        // If we await, the tick loop halts and we can't react to higher priority events.
        if (proposal.execute) {
            proposal.execute().catch(e => {
                console.error(`[GoalManager] Goal Execution Failed:`, e);
                // If goal crashes, we should probably reset so we can pick a new one
                if (this.activeGoal === proposal) {
                    this.activeGoal = null;
                }
            });
        }
    }

    /**
     * Lock the manager (e.g. during PVP or delicate operations)
     */
    lock() { this.isLocked = true; }
    unlock() { this.isLocked = false; }
}

module.exports = GoalManager;
