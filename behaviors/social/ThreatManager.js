class ThreatManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    assessThreats() {
        const players = Object.values(this.bot.players).filter(p => p.username !== this.bot.username);
        let maxThreat = 0;
        let dangerousPlayer = null;

        for (const player of players) {
            if (!player.entity) continue; // Not in render distance

            const dist = this.bot.entity.position.distanceTo(player.entity.position);
            if (dist > 64) continue;

            let threatLevel = 0;

            // 1. Gear Check
            const mainHand = player.entity.heldItem;
            if (mainHand) {
                if (mainHand.name.includes('diamond')) threatLevel += 50;
                if (mainHand.name.includes('netherite')) threatLevel += 80;
                if (mainHand.name.includes('sword') || mainHand.name.includes('axe')) threatLevel += 20;
            }

            // 2. Behavior Check
            // Moving towards bot?
            const vel = player.entity.velocity;
            // TODO: complex velocity analysis

            if (dist < 10) threatLevel += 30; // Too close

            if (threatLevel > maxThreat) {
                maxThreat = threatLevel;
                dangerousPlayer = player;
            }
        }

        return { level: maxThreat, player: dangerousPlayer };
    }
}

module.exports = ThreatManager;
