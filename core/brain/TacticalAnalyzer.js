const Vec3 = require('vec3');

class TacticalAnalyzer {
    constructor(botCore) {
        this.botCore = botCore;
        this.THREAT_LEVELS = {
            SAFE: 0,
            CAUTION: 1, // Naked players, mobs
            DANGER: 2,  // Armed players
            LETHAL: 3   // Crystal PVPers, 2v1s, Low HP
        };
    }

    get bot() { return this.botCore.bot; }

    /**
     * Analyze current situation and return threat level
     */
    analyze() {
        if (!this.bot || !this.bot.entity) return { level: this.THREAT_LEVELS.SAFE, reason: 'Offline' };

        const health = this.bot.health;
        const enemies = this.getNearbyEnemies();

        // 1. Critical Health Check
        if (health < 6) return { level: this.THREAT_LEVELS.LETHAL, reason: 'Low HP (<3 hearts)' };

        // 2. Enemy Count Check
        if (enemies.length === 0) return { level: this.THREAT_LEVELS.SAFE, reason: 'No enemies' };
        if (enemies.length >= 2) return { level: this.THREAT_LEVELS.LETHAL, reason: 'Outnumbered' };

        // 3. Gear Check
        const target = enemies[0];
        const threatScore = this.calculateGearScore(target);

        if (threatScore > 500) { // Diamond/Netherite + Enchants
            if (health < 12) return { level: this.THREAT_LEVELS.LETHAL, reason: 'Strong Enemy + Mid HP' };
            return { level: this.THREAT_LEVELS.DANGER, reason: 'Strong Enemy' }; // Fightable but risky
        }

        return { level: this.THREAT_LEVELS.CAUTION, reason: 'Weak Enemy' };
    }

    getNearbyEnemies() {
        return this.bot.entities ? Object.values(this.bot.entities).filter(e =>
            e.type === 'player' &&
            e.username !== this.bot.username &&
            e.position.distanceTo(this.bot.entity.position) < 16 &&
            !this.isFriend(e.username)
        ) : [];
    }

    isFriend(username) {
        // TODO: Integrate SocialGraph or simple friend list
        const owner = this.botCore.config.owner?.name;
        if (username === owner) return true;
        return false;
    }

    calculateGearScore(entity) {
        if (!entity) return 0;
        // Simple heuristic: Count armor points + held item
        // Detailed analysis needs ItemEvaluator but we can't inspect others' inventory easily
        // We can check visible equipment.
        let score = 0;

        // Equipment array: 0:hand, 1:offhand, 2:feet, 3:legs, 4:chest, 5:head (approx)
        // Entity.equipment is array of Items.
        if (entity.equipment) {
            entity.equipment.forEach(item => {
                if (!item) return;
                if (item.name.includes('netherite')) score += 200;
                else if (item.name.includes('diamond')) score += 100;
                else if (item.name.includes('iron')) score += 50;
            });
        }

        return score;
    }
}

module.exports = TacticalAnalyzer;
