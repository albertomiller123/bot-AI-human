const TacticalAnalyzer = require('./TacticalAnalyzer');

class StrategyBrain {
    constructor(botCore) {
        this.botCore = botCore;
        this.analyzer = new TacticalAnalyzer(botCore);
        this.state = 'IDLE';
    }

    /**
     * Called by GoalManager to get a proposal.
     * StrategyBrain is a High Priority Source (Agent Level).
     */
    async getProposal() {
        const analysis = this.analyzer.analyze();
        const THREAT = this.analyzer.THREAT_LEVELS;

        // 1. SURVIVAL OVERRIDE (LETHAL)
        if (analysis.level === THREAT.LETHAL) {
            return {
                id: 'strategy_survival_retreat',
                priority: 100, // Highest
                description: `Retreating! ${analysis.reason}`,
                execute: async () => await this.executeRetreat()
            };
        }

        // 2. COMBAT (DANGER)
        if (analysis.level === THREAT.DANGER) {
            return {
                id: 'strategy_combat_crystal',
                priority: 90,
                description: `Engaging Strong Enemy (${analysis.reason})`,
                execute: async () => {
                    this.currentCombat = 'crystal';
                    await this.executeCombat(true);
                },
                stop: async () => {
                    console.log("[Strategy] Stopping Crystal Combat");
                    if (this.botCore.crystalCombat) this.botCore.crystalCombat.stop();
                    this.currentCombat = null;
                }
            };
        }

        // 3. COMBAT (CAUTION - Bullies weak players)
        if (analysis.level === THREAT.CAUTION) {
            // Configurable aggression? For now, we are "Mean".
            return {
                id: 'strategy_combat_bully',
                priority: 80,
                description: `Bullying Weak Enemy (${analysis.reason})`,
                execute: async () => {
                    this.currentCombat = 'melee';
                    await this.executeCombat(false);
                },
                stop: async () => {
                    console.log("[Strategy] Stopping Melee Combat");
                    // Stop basic combat pathfinding/attack loop
                    if (this.botCore.behaviors.combat) {
                        // Assuming combat module has a stop/cleanup? 
                        // If not, we just stop pathfinder.
                        this.botCore.bot.pathfinder.setGoal(null);
                    }
                }
            };
        }

        // 4. MAINTENANCE (IDLE)
        // If safe, check if we need to fix gear or craft.
        // This is lower priority than active tasks from User.
        // So we return NULL, letting User commands or GoalManager defaults take over.

        return null;
    }

    async executeRetreat() {
        console.log("[Strategy] 🏳️ EXECUTING RETREAT");
        const bot = this.botCore.bot;

        // 1. Pearl Away?
        const pearl = bot.inventory.items().find(i => i.name === 'ender_pearl');
        if (pearl) {
            await bot.equip(pearl, 'hand');
            // Throw vaguely away from enemies
            // Simply throw forward -> high pitch
            await bot.look(bot.entity.yaw, 0.5, true);
            bot.activateItem();
            await new Promise(r => setTimeout(r, 500));
        }

        // 2. Sprint Jump away
        // Simple retreat logic: Find direction away from nearest enemy
        const enemies = this.analyzer.getNearbyEnemies();
        if (enemies.length > 0) {
            const enemy = enemies[0];
            const escapeDir = bot.entity.position.minus(enemy.position).normalize();
            const goal = bot.entity.position.plus(escapeDir.scaled(30)); // Run 30 blocks away

            // Use Pathfinder
            await this.botCore.primitives.move_to(goal);
        }
    }

    async executeCombat(useCrystals) {
        console.log(`[Strategy] ⚔️ EXECUTING COMBAT (Crystals: ${useCrystals})`);
        const enemies = this.analyzer.getNearbyEnemies();
        if (enemies.length === 0) return;
        const target = enemies[0];

        if (useCrystals && this.botCore.crystalCombat) {
            // High Tier Combat
            this.botCore.crystalCombat.start(target);
            // Monitor loop? GoalManager execute is fire-and-forget.
            // We need a way to stop. 
            // When GoalManager switches goal, it calls stop().
            // But we didn't define stop method in proposal.
            // Wait... GoalManager supports .stop on proposal?
            // "if (this.activeGoal.stop)" - Checking GoalManager.js
            // But proposal is a plain object. 
            // We should return an object that HAS a stop function/method references.

            // FIX: We need to design the proposal to maintain state or rely on the loop re-evaluating.
            // If we fire crystalCombat.start(), it runs a loop.
            // We need to stop it when this goal loses priority.
        } else {
            // Low Tier Combat (Melee)
            /* 
               We rely on CombatModule logic or simple attack.
               this.botCore.behaviors.combat.attack(target);
            */
            if (this.botCore.behaviors.combat) {
                await this.botCore.behaviors.combat.attack(target);
            }
        }
    }
}

module.exports = StrategyBrain;
