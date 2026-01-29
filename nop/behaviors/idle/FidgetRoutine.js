class FidgetRoutine {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    async fidget() {
        if (Math.random() > 0.8) return; // Only 20% chance to fidget when called

        const actions = [
            'look_around',
            'swap_hand',
            'jump_in_place',
            'sneak_spam'
        ];

        const action = actions[Math.floor(Math.random() * actions.length)];
        console.log(`[Humanizer] Fidgeting: ${action}`);

        switch (action) {
            case 'look_around':
                await this.bot.look(this.bot.entity.yaw + 1, 0); // Spin a bit
                await new Promise(r => setTimeout(r, 500));
                await this.bot.look(this.bot.entity.yaw - 1, 0);
                break;
            case 'swap_hand':
                // Swap main/offhand (F key)
                // Mineflayer doesn't have direct 'swap hands' packet easily accessible without window manipulation or plugin
                // Simulating via slot swap logic if needed, or simple ignore for MVP
                break;
            case 'jump_in_place':
                this.bot.setControlState('jump', true);
                await new Promise(r => setTimeout(r, 200));
                this.bot.setControlState('jump', false);
                break;
            case 'sneak_spam':
                this.bot.setControlState('sneak', true);
                await new Promise(r => setTimeout(r, 100));
                this.bot.setControlState('sneak', false);
                await new Promise(r => setTimeout(r, 100));
                this.bot.setControlState('sneak', true);
                await new Promise(r => setTimeout(r, 100));
                this.bot.setControlState('sneak', false);
                break;
        }
    }
}

module.exports = FidgetRoutine;
