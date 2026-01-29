const { goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const { Vec3 } = require('vec3');

class GuardBehavior {
    constructor(botCore) {
        this.botCore = botCore;
        // Note: Do NOT assign this.bot here - it's null at construction time
        this.isActive = false;
        this.radius = 20;
        this.basePos = null;
        this.isFighting = false;
        this.scanInterval = null;
    }

    // Lazy getter - bot is only available after spawn
    get bot() { return this.botCore.bot; }

    start(radius = 20) {
        if (this.isActive) return;
        this.isActive = true;
        this.radius = radius;
        this.basePos = this.bot.entity.position.clone();

        this.botCore.say(`🛡️ Guard Mode ACTIVATED. Base set at ${this.basePos}. Radius: ${radius}`);
        this.botCore.memoryManager?.saveLocation('base', this.basePos); // Ensure base is updated

        this.scanInterval = setInterval(() => this.scanLoop(), 1000); // Scan every second
    }

    stop() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.scanInterval) clearInterval(this.scanInterval);
        if (this.bot?.pvp) this.bot.pvp.stop();
        if (this.bot?.pathfinder) this.bot.pathfinder.setGoal(null);
        this.isFighting = false;
        this.botCore.say("🛑 Guard Mode DEACTIVATED.");
    }

    async scanLoop() {
        if (!this.isActive || this.isFighting) return;

        // 1. Check health
        if (this.bot.health < 10) {
            // Let SurvivalSystem handle eating, but maybe retreat?
            // this.botCore.survivalSystem.eat();
        }

        // 2. Scan for threats
        const target = this.scanForThreats();
        if (target) {
            await this.engage(target);
        } else {
            // 3. Patrol / Return to Base
            await this.patrol();
        }
    }

    scanForThreats() {
        // Filter entities: Mob/Player, Hostile, Within Radius
        const validThreats = Object.values(this.bot.entities).filter(e => {
            if (!e || !e.position) return false;

            // Distance check
            const dist = e.position.distanceTo(this.basePos);
            if (dist > this.radius) return false;

            // Type check
            const isHostile = (e.type === 'hostile' || e.type === 'mob'); // Mineflayer sometimes categorizes differently
            // Note: 'mob' includes passive ones, we need specific check or rely on 'hostile'
            // For now, attack specific hostile names or use mineflayer-pvp detection?
            // Simple whitelist check for now
            const hostileNames = ['zombie', 'skeleton', 'creeper', 'spider', 'witch', 'pillager', 'enderman'];
            const isEnemyMob = hostileNames.includes(e.name);

            // Player check (PVP)
            const isPlayer = (e.type === 'player' && e.username !== this.bot.username);

            // Whitelist Check (Owner/Friends)
            if (isPlayer) {
                if (this.botCore.config.owner && e.username === this.botCore.config.owner.name) return false;
                // TODO: Check friends list
            }

            return isEnemyMob || isPlayer;
        });

        // Return closest threat
        if (validThreats.length > 0) {
            validThreats.sort((a, b) => a.position.distanceTo(this.bot.entity.position) - b.position.distanceTo(this.bot.entity.position));
            return validThreats[0];
        }

        return null;
    }

    async engage(target) {
        if (this.isFighting) return;
        this.isFighting = true;

        this.botCore.say(`⚔️ Phat hien ${target.name || 'ke thu'}! TAN CONG!`);

        try {
            await this.bot.pvp.attack(target);
        } catch (err) {
            console.log("Combat error/stopped:", err.message);
        } finally {
            this.isFighting = false;
            this.bot.pvp.stop();
        }
    }

    async patrol() {
        // If far from base and not fighting, return to base
        const currentDist = this.bot.entity.position.distanceTo(this.basePos);
        if (currentDist > 5) {
            // Only move if we are significantly away
            // And not doing something else (like task manager stuff)
            // But Guard Mode usually overrides Idle.

            // Use pathfinder to go near base
            try {
                // Don't await forever, just start moving
                // But primitives move is blocking.
                // We should use a non-blocking move or just set goal?

                await this.bot.pathfinder.goto(new GoalBlock(this.basePos.x, this.basePos.y, this.basePos.z));
            } catch (e) {
                // Ignore path errors
            }
        }
    }
}

module.exports = GuardBehavior;
