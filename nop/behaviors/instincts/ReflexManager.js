const { goals } = require('mineflayer-pathfinder');

class ReflexManager {
    constructor(botCore) {
        this.botCore = botCore;

        // Configs (Dynamic from botCore.config)
        // Ensure defaults exist
        if (!this.botCore.config.reflex) {
            this.botCore.config.reflex = {
                lootingEnabled: true,
                combatEnabled: false,
                tacticalEnabled: true
            };
        }
    }

    get bot() { return this.botCore.bot; }

    check(stateStack, watchdog) {
        if (!this.botCore.bot.entity) return;
        if (stateStack.active) return;

        const cfg = this.botCore.config.reflex;

        // Priority 1: Combat (Self Defense)
        if (cfg.combatEnabled && this.checkCombat(stateStack)) return;

        // Priority 2: Tactical (Spawner)
        if (cfg.tacticalEnabled && this.checkTactical(stateStack)) return;

        // Priority 3: Looting (Magpie)
        if (cfg.lootingEnabled && this.checkLooting(stateStack)) return;
    }

    // --- 1. Combat Reflex ---
    checkCombat(stack) {
        // If taking damage or dangerous mob very close (<3 blocks)
        const health = this.bot.health;
        // Check "Hurt recently" logic handled by SurvivalSystem event, 
        // here we check "Pre-emptive defense"

        const enemy = this.bot.nearestEntity(e =>
            (e.type === 'hostile') &&
            e.position.distanceTo(this.bot.entity.position) < 4
        );

        if (enemy) {
            console.log("[Reflex] ⚔️ COMBAT INSTINCT TRIGGERED!");
            stack.push('combat_reflex', { target: enemy });

            // Execute Fight Logic Immediately
            this.botCore.survivalSystem.pvp.attack(enemy).then(() => {
                stack.pop(); // Resume goal when done
            });
            return true;
        }
        return false;
    }

    // --- 2. Tactical Reflex (Spawners) ---
    checkTactical(stack) {
        const spawner = this.bot.findBlock({
            matching: this.botCore.mcData.blocksByName['spawner'].id,
            maxDistance: 6
        });

        if (spawner) {
            // Check if already torched (simplified check: is there light?)
            // For MVP: Just check if we have visited/marked it? 
            // Better: Check if valid path.

            // Limit frequency
            if (Date.now() - this.lastLootTime < 30000) return false;

            console.log("[Reflex] 🔥 TACTICAL INSTINCT: SPAWNER FOUND!");
            stack.push('spawner_suppress');
            this.lastLootTime = Date.now();

            this.suppressSpawner(spawner).then(() => {
                stack.pop();
            });
            return true;
        }
        return false;
    }

    // --- 3. Looting Reflex (Magpie) ---
    checkLooting(stack) {
        if (this.bot.inventory.emptySlotCount() < 3) return false; // Full inventory
        if (Date.now() - this.lastLootTime < 10000) return false; // Cooldown

        const chest = this.bot.findBlock({
            matching: [
                this.botCore.mcData.blocksByName['chest'].id,
                this.botCore.mcData.blocksByName['barrel'].id
            ],
            maxDistance: 5
        });

        if (chest) {
            console.log("[Reflex] 💎 MAGPIE INSTINCT: CHEST FOUND!");
            stack.push('loot_reflex');
            this.lastLootTime = Date.now();

            this.lootChest(chest).then(() => {
                this.botCore.survivalSystem.cognitive.logExperience('Loot', 'Looted a chest found on the way');
                stack.pop();
            });
            return true;
        }
        return false;
    }

    // --- ACTIONS ---

    async suppressSpawner(block) {
        // Simple goal: Walk on top of it (pathfinder) and place torch
        // Real impl requires detailed placement logic. MVP: Just walk to it.
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        this.botCore.pathfinder.setGoal(goal);
        // Wait for arrival logic... (omitted for MVP sync simplicity, relying on Goal completion or timeout)
        await this.bot.waitForTicks(20);
        // Place torch
        // const torch = this.bot.inventory.items().find(i => i.name.includes('torch'));
        // if (torch) await this.bot.placeBlock(block, new Vec3(0, 1, 0));
    }

    async lootChest(block) {
        const goal = new goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z);
        this.botCore.pathfinder.setGoal(goal);

        // Wait to open (Basic logic)
        // In real V2, we need `await goalReached`
        // Simply returning here allows Watchdog to monitor if we get stuck going to chest
    }
}

module.exports = ReflexManager;
