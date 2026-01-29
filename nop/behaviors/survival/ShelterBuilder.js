const { Vec3 } = require('vec3');

class ShelterBuilder {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    async buildBasicShelter() {
        console.log("[Shelter] Panic! It's dark. Building shelter...");

        // Strategy: Dig a 3-block deep hole and cover top
        try {
            const pos = this.bot.entity.position.floored();

            // 1. Dig hole
            await this.bot.dig(this.bot.blockAt(pos)); // Feet
            await this.bot.dig(this.bot.blockAt(pos.offset(0, -1, 0))); // Below
            await this.bot.dig(this.bot.blockAt(pos.offset(0, -2, 0))); // Deep

            // 2. Jump in (gravity handles this if we dug under feet, but let's be safe)
            // Actually dig under feet makes us fall.
            // Let's cover head.

            // TODO: Proper block placing logic
            // For Phase 1 MVP, we just dig into a wall maybe?

            console.log("[Shelter] Hiding in hole.");
            return true;
        } catch (err) {
            console.log(`[Shelter] Failed: ${err.message}`);
            return false;
        }
    }
}

module.exports = ShelterBuilder;
