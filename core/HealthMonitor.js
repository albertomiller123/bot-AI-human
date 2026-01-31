/**
 * HealthMonitor.js - Autonomous Survival Loop
 * Monitors hunger, health, and time. Takes automatic actions to keep bot alive.
 * Runs independently, pausing TaskManager when needed.
 */

class HealthMonitor {
    constructor(botCore) {
        this.botCore = botCore;
        this.interval = null;
        this.isProcessing = false;

        // Thresholds (configurable)
        this.hungerThreshold = 14;      // Eat when food < 14
        this.criticalHealth = 8;        // Flee/heal when health < 8
        this.emergencyHealth = 4;       // Emergency totem when health < 4
    }

    get bot() { return this.botCore.bot; }

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => this.tick(), 2000); // Every 2 seconds
        console.log("[HealthMonitor] Started autonomous survival loop");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async tick() {
        // Safety checks
        if (!this.bot || !this.botCore.isInitialized) return;
        if (this.isProcessing) return;

        this.isProcessing = true;

        // Critical Section: Lock GoalManager to prevent interruptions (e.g. Brain trying to chat)
        // Only lock if we actually need to do something? 
        // For simplicity, we lock during the check-and-act cycle, but optimize to verify action first?
        // Actually, we should only lock if checkHunger/Health RETURNS true (took action).
        // Let's adopt a simpler approach: Lock for the duration of the tick if we are in critical state?
        // No, 'checkHunger' is async and takes time to consume. We must lock BEFORE consuming.

        let locked = false;

        try {
            // We'll pass a "locker" callback to sub-functions? Or just lock here?
            // Let's modify checkHunger/Health to manage locking if they ACT.

            await this.checkHunger();
            await this.checkHealth();
            await this.checkTime();
        } catch (e) {
            console.warn("[HealthMonitor] Tick error:", e.message);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Helper to lock goal manager if available
     */
    _lockGoal() {
        if (this.botCore && this.botCore.goalManager) {
            this.botCore.goalManager.lock();
        }
    }

    _unlockGoal() {
        if (this.botCore && this.botCore.goalManager) {
            this.botCore.goalManager.unlock();
        }
    }

    /**
     * Auto-eat when hungry
     */
    async checkHunger() {
        if (this.bot.food >= this.hungerThreshold) return;

        const food = this.findFood();
        if (!food) {
            console.log("[HealthMonitor] Hungry but no food!");
            return;
        }

        console.log(`[HealthMonitor] Hungry (${this.bot.food}/20), eating ${food.name}...`);

        this._lockGoal(); // Lock to prevent interruption
        try {
            await this.bot.equip(food, 'hand');
            await this.bot.consume();
            console.log("[HealthMonitor] Ate successfully");
        } catch (e) {
            console.warn("[HealthMonitor] Eating failed:", e.message);
        } finally {
            this._unlockGoal(); // Always unlock
        }
    }

    /**
     * Find edible food in inventory
     */
    findFood() {
        const edible = [
            'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton',
            'cooked_rabbit', 'cooked_salmon', 'cooked_cod', 'baked_potato',
            'bread', 'golden_carrot', 'golden_apple', 'enchanted_golden_apple',
            'apple', 'carrot', 'melon_slice', 'sweet_berries', 'cookie',
            'pumpkin_pie', 'mushroom_stew', 'rabbit_stew', 'beetroot_soup',
            'suspicious_stew', 'dried_kelp'
        ];

        const items = this.bot.inventory.items();
        for (const name of edible) {
            const item = items.find(i => i.name === name);
            if (item) return item;
        }

        // Fallback: any food item
        return items.find(i => i.name.includes('cooked') || i.name.includes('bread'));
    }

    /**
     * Check health and take emergency action
     */
    async checkHealth() {
        const health = this.bot.health;

        // Emergency totem equip
        if (health < this.emergencyHealth) {
            const totem = this.bot.inventory.items().find(i => i.name === 'totem_of_undying');
            const offhand = this.bot.inventory.slots[45];
            if (offhand?.name !== 'totem_of_undying') {
                console.log("[HealthMonitor] EMERGENCY! Equipping totem...");
                this._lockGoal();
                try {
                    await this.bot.equip(totem, 'off-hand');
                } catch (e) { /* ignore */ }
                finally { this._unlockGoal(); }
            }
        }

        // Low health - try to flee
        if (health < this.criticalHealth) {
            const nearbyHostile = Object.values(this.bot.entities).find(e =>
                e.type === 'hostile' &&
                e.position.distanceTo(this.bot.entity.position) < 10
            );

            if (nearbyHostile) {
                console.log("[HealthMonitor] Low health + hostile nearby! Fleeing...");
                this._lockGoal();
                try {
                    await this.flee(nearbyHostile);
                } finally {
                    this._unlockGoal();
                }
            }
        }
    }

    /**
     * Flee from an entity
     */
    async flee(entity) {
        if (!entity || !this.bot.pathfinder) return;

        try {
            // Run opposite direction
            const { goals } = require('mineflayer-pathfinder');
            const fleeGoal = new goals.GoalInvert(new goals.GoalFollow(entity, 20));
            this.bot.pathfinder.setGoal(fleeGoal, true);

            // Run for 3 seconds then stop
            await new Promise(r => setTimeout(r, 3000));
            this.bot.pathfinder.stop();
        } catch (e) {
            console.warn("[HealthMonitor] Flee failed:", e.message);
        }
    }

    /**
     * Check time of day - shelter at night if vulnerable
     */
    async checkTime() {
        if (!this.bot.time) return;

        const time = this.bot.time.timeOfDay;
        const isNight = time > 13000 && time < 23000;

        if (!isNight) return;

        // Check if we have protective gear
        const hasSword = this.bot.inventory.items().some(i => i.name.includes('sword'));
        const hasArmor = this.bot.inventory.slots[5] !== null; // Chestplate slot

        if (hasSword && hasArmor) return; // We can handle night

        // Check if we're inside (has block above)
        const above = this.bot.blockAt(this.bot.entity.position.offset(0, 2, 0));
        if (above && above.name !== 'air') return; // Already sheltered

        // Try to find/use bed
        const bed = this.bot.inventory.items().find(i => i.name.includes('bed'));
        if (bed) {
            console.log("[HealthMonitor] Night time, trying to sleep...");
            try {
                // Place and sleep logic would go here
                // For now, just crouch in place
                this.bot.setControlState('sneak', true);
                await new Promise(r => setTimeout(r, 5000));
                this.bot.setControlState('sneak', false);
            } catch (e) { /* ignore */ }
        }
    }
}

module.exports = HealthMonitor;
