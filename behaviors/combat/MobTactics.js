class MobTactics {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    async fightBlaze(blaze) {
        console.log(`[Combat] Engaging Blaze ${blaze.id}`);
        // Tactics:
        // 1. Equip Shield in Offhand
        // 2. Keep distance (bow) or hit & run
        // 3. Block when it shoots fireballs

        await this.bot.lookAt(blaze.position.offset(0, 1.5, 0));

        // Simple Shield Logic
        const dist = this.bot.entity.position.distanceTo(blaze.position);
        if (dist > 5) {
            // Move closer carefully
            this.bot.setControlState('forward', true);
        } else {
            this.bot.setControlState('forward', false);
            // Attack
            await this.bot.attack(blaze);
            // Block immediately
            this.bot.activateItem(true);
            await new Promise(r => setTimeout(r, 500));
            this.bot.deactivateItem();
        }
    }

    async fightEnderman(enderman) {
        console.log("[Combat] Engaging Enderman - Aim for feet!");
        // Look at feet to avoid aggro if neutral? No, we want to kill.
        // Hit feet to prevent teleport? Legend says so.
        await this.bot.lookAt(enderman.position);
        this.bot.attack(enderman);
    }
}

module.exports = MobTactics;
