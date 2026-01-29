class StealthTactics {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.threatManager = new (require('./ThreatManager'))(botCore);
    }

    update() {
        if (!this.bot.entity) return;

        const { level, player } = this.threatManager.assessThreats();

        // AUTO SNEAK to hide nametag
        if (player && level > 20) {
            const dist = this.bot.entity.position.distanceTo(player.entity.position);
            if (dist < 32 && !this.bot.getControlState('sneak')) {
                console.log(`[Stealth] Threat detected (${player.username}). Sneaking.`);
                this.bot.setControlState('sneak', true);
            }
        } else {
            if (this.bot.getControlState('sneak')) {
                this.bot.setControlState('sneak', false);
            }
        }
    }
}

module.exports = StealthTactics;
