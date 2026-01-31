const Vec3 = require('vec3');

class BlacksmithManager {
    constructor(botCore) {
        this.botCore = botCore;
    }

    get bot() { return this.botCore.bot; }

    /**
     * Ensure bot has at least `levels` XP.
     * Drinks bottles if needed.
     */
    async ensureXP(levels) {
        if (!this.bot.experience) return false; // Not spawned?

        console.log(`[Blacksmith] XP Check: Current ${this.bot.experience.level}, Needed ${levels}`);

        if (this.bot.experience.level >= levels) return true;

        // Drink bottles
        const bottles = this.bot.inventory.items().find(i => i.name === 'experience_bottle');
        if (!bottles) {
            console.log("[Blacksmith] Low XP and no bottles!");
            return false;
        }

        await this.bot.equip(bottles, 'hand');

        // Loop drink until level reached or out of bottles
        while (this.bot.experience.level < levels) {
            const freshBottles = this.bot.inventory.items().find(i => i.name === 'experience_bottle');
            if (!freshBottles) break;

            // Look down (safety)
            await this.bot.look(this.bot.entity.yaw, -Math.PI / 2, true);
            this.bot.activateItem();
            await new Promise(r => setTimeout(r, 250)); // Drink delay
        }

        return this.bot.experience.level >= levels;
    }

    /**
     * Combine two items in an anvil.
     * @param {string} targetName - Name of item to upgrade (e.g. 'diamond_sword')
     * @param {string} sacName - Name of item to sacrifice (e.g. 'enchanted_book')
     */
    async startAnrilRoutine(targetName, sacName) {
        // 1. Find Items
        const target = this.bot.inventory.items().find(i => i.name === targetName);
        const sacrifice = this.bot.inventory.items().find(i => i.name === sacName && i !== target);

        if (!target || !sacrifice) {
            console.log("[Blacksmith] Missing items for anvil.");
            return false;
        }

        // 2. Find Anvil Block
        const anvilBlock = this.bot.findBlock({
            matching: b => b.name.includes('anvil'),
            maxDistance: 32
        });

        if (!anvilBlock) {
            console.log("[Blacksmith] No anvil nearby.");
            // TODO: Craft logic?
            return false;
        }

        // 3. Go to Anvil
        await this.botCore.primitives.move_to(anvilBlock.position);

        try {
            // 4. Open Anvil
            const anvil = await this.bot.openAnvil(anvilBlock);

            // 5. Place Items
            // combine(item, sacrifice, name)
            // Note: Mineflayer's openAnvil returns a Window instance specialized for Anvils

            // Check cost? 
            // The window emits 'update' when items change.

            console.log("[Blacksmith] combining...");
            await anvil.combine(target, sacrifice);

            // 6. Close
            anvil.close();
            console.log("[Blacksmith] Anvil done.");
            return true;

        } catch (e) {
            console.log("[Blacksmith] Anvil Failed:", e.message);
            return false;
        }
    }
}

module.exports = BlacksmithManager;
