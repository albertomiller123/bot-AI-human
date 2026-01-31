const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;

class HomeBehavior {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    /**
     * Set current location as 'base'
     */
    async setHome() {
        if (!this.bot || !this.bot.entity) return false;

        try {
            const pos = this.bot.entity.position;
            // Round coordinates for cleaner data
            const location = {
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                z: Math.round(pos.z)
            };

            await this.botCore.memory.saveLocation('base', location);
            this.botCore.say(`Base established at ${location.x}, ${location.y}, ${location.z}`);
            console.log(`[Home] Base set at ${JSON.stringify(location)}`);
            return true;
        } catch (e) {
            console.error("[Home] Error setting home:", e);
            return false;
        }
    }

    /**
     * Go to 'base' location
     */
    async goHome() {
        try {
            const location = await this.botCore.memory.getLocation('base');

            if (!location) {
                this.botCore.say("I don't have a home yet. Use 'set home' to mark it.");
                return false;
            }

            console.log(`[Home] Heading to base at ${location.x}, ${location.y}, ${location.z}...`);
            this.botCore.say("Coming home...");

            await this.bot.pathfinder.goto(new GoalNear(location.x, location.y, location.z, 1));
            this.botCore.say("I am home.");
            return true;

        } catch (e) {
            console.error("[Home] Error going home:", e);
            this.botCore.say("Can't reach home. I might be stuck.");
            return false;
        }
    }
}

module.exports = HomeBehavior;
