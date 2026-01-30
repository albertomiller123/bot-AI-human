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

        // Stickiness Factor: Don't switch if priority difference is small (< 5)
        // unless it's the SAME source updating its goal
        if (this.activeGoal) {
            if (bestProposal.priority <= this.activeGoal.priority + 5 && bestProposal.source !== this.activeGoal.source) {
                return; // Stick to current goal
            }
        }

        // 3. Switch Goal
        if (!this.activeGoal || this.activeGoal.id !== bestProposal.id) {
            await this.setGoal(bestProposal);
        }
    }

    async setGoal(proposal) {
        console.log(`[GoalManager] 🔀 Switching Goal: [${this.activeGoal?.id || 'None'}] -> [${proposal.id}] (Src: ${proposal.source}, Prio: ${proposal.priority})`);

        // 1. Cleanup Old Goal (if needed)
        // TODO: Implement cleanup callbacks

        this.activeGoal = proposal;

        // 2. Execute New Goal
        // The winning source is responsible for execution, OR we delegate here?
        // Unification Strategy: GoalManager executes specific handlers OR delegates back.
        // For MVP: Delegate back to specific systems via signals or assume they monitor activeGoal?

        // Better: The proposal object contains an `execute` function?
        if (proposal.execute) {
            try {
                await proposal.execute();
            } catch (e) {
                console.error(`[GoalManager] Goal Execution Failed:`, e);
                this.activeGoal = null; // Reset
            }
        }
    }

    /**
     * Lock the manager (e.g. during PVP or delicate operations)
     */
    lock() { this.isLocked = true; }
    unlock() { this.isLocked = false; }
}

module.exports = GoalManager;
