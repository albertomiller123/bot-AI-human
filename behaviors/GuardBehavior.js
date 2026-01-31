const { Vec3 } = require('vec3');

class GuardBehavior {
    constructor(botCore) {
        console.log("GuardBehavior constructor start");
        this.botCore = botCore;
        this.isActive = false;
        this.basePos = null;
        this.radius = 20;
        this.interval = null;
        this.engageTarget = null;
        console.log("GuardBehavior constructor end");
    }

    get bot() { return this.botCore.bot; }

    start(radius = 20) {
        if (!this.bot || !this.bot.entity) {
            console.error("[Guard] Cannot start: Bot not ready.");
            return;
        }

        this.basePos = this.bot.entity.position.clone();
        this.radius = radius;
        this.isActive = true;
        this.engageTarget = null;

        console.log(`[Guard] Started. Base: ${this.basePos}, Radius: ${this.radius}`);
        this.botCore.say(`Guard Mode ON. Base set at ${this.basePos.floored()}. Radius: ${this.radius}`);

        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.tick(), 1000);
    }

    stop() {
        this.isActive = false;
        if (this.interval) clearInterval(this.interval);
        this.engageTarget = null;

        if (this.bot && this.bot.pvp) {
            this.bot.pvp.stop();
        }

        console.log("[Guard] Stopped.");
        this.botCore.say("Guard Mode OFF.");
    }

    async tick() {
        if (!this.isActive || !this.bot) return;

        // Priority 1: Check Health
        await this.checkHealth();

        // Priority 2: Engage existing target
        if (this.engageTarget) {
            if (!this.isValidTarget(this.engageTarget)) {
                console.log("[Guard] Target lost/dead. Returning to patrol.");
                this.engageTarget = null;
                this.bot.pvp.stop();
            } else {
                return; // Let PVP plugin handle combat
            }
        }

        // Priority 3: Scan for new threats
        const target = this.scanForThreats();
        if (target) {
            this.engage(target);
            return;
        }

        // Priority 4: Return to base if too far
        const dist = this.bot.entity.position.distanceTo(this.basePos);
        if (dist > this.radius * 1.5 || (dist > 5 && !this.engageTarget)) {
            // Only move back if significantly away or idle
            // Use primitive move to avoid conflict
            // But we are in a tick loop, so we should check if moving.
            if (!this.bot.pathfinder.isMoving()) {
                console.log("[Guard] Returning to base...");
                // Use move_to from primitives if possible, or direct pathfinder
                // this.botCore.primitives.move_to(this.basePos).catch(() => {});
                // Use raw pathfinder to be safe async
                const { goals } = require('mineflayer-pathfinder');
                this.bot.pathfinder.setGoal(new goals.GoalNear(this.basePos.x, this.basePos.y, this.basePos.z, 1));
            }
        }
    }

    scanForThreats() {
        const filter = (e) => {
            // Must be hostile OR player (except owner/friends)
            // Mineflayer uses 'mob' for generic mobs, 'hostile' is custom or rare
            const isHostile = e.type === 'hostile' || e.type === 'mob';
            const isPlayer = e.type === 'player' && e.username !== this.bot.username;

            if (!isHostile && !isPlayer) return false;

            // Range check
            if (e.position.distanceTo(this.bot.entity.position) > this.radius) return false;

            // Whitelist check
            if (isPlayer && this.isWhitelisted(e.username)) return false;

            return true;
        };

        return this.bot.nearestEntity(filter);
    }

    isWhitelisted(username) {
        const configOwner = this.botCore.config.owner?.name;
        if (username === configOwner) return true;

        // Check friends list (if exists in memory)
        // Future: this.botCore.memory.isFriend(username)
        return false;
    }

    async engage(target) {
        console.log(`[Guard] Engaging threat: ${target.name || target.username}`);
        this.engageTarget = target;

        // SHIELD LOGIC: Prepare for combat
        try {
            const offHandItem = this.bot.inventory.slots[45]; // 45 is off-hand slot
            const shield = this.bot.inventory.items().find(i => i.name.includes('shield'));

            if (offHandItem && offHandItem.name !== 'shield') {
                console.log("[Guard] Unequipping off-hand item for combat...");
                await this.bot.unequip('off-hand');
            }

            if (shield && (!offHandItem || offHandItem.name !== 'shield')) {
                console.log("[Guard] Equipping shield...");
                await this.bot.equip(shield, 'off-hand');
            }
        } catch (e) {
            console.warn("[Guard] Shield equip failed:", e.message);
        }

        this.bot.pvp.attack(target);
    }

    async checkHealth() {
        if (this.bot.health < 10) {
            // Try to eat via behaviors wrapper
            // This relies on eat_until_full being available and properly locking action
            // For tick loop, we might just want to trigger it once
            if (this.bot.food < 20) {
                // Simple consume attempt
                const food = this.bot.inventory.items().find(i => i.name.includes('cooked') || i.name.includes('bread'));
                if (food) {
                    await this.bot.equip(food, 'hand');
                    await this.bot.consume();
                }
            }
        }
    }
}

module.exports = GuardBehavior;
