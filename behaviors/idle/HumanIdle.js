/**
 * HumanIdle.js - Smart Idling
 * 
 * Instead of spinning randomly, the bot performs "fidgets":
 * - Sorting inventory
 * - Checking chest
 * - Looking at interesting blocks
 * - Crouching/uncrouching
 */
class HumanIdle {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.isFidgeting = false;
        this.lastFidgetTime = 0;
    }

    async doIdle() {
        if (this.isFidgeting) return;

        // Don't fidget too often (every 5-10 seconds)
        if (Date.now() - this.lastFidgetTime < 5000) return;

        this.isFidgeting = true;
        this.lastFidgetTime = Date.now();

        try {
            const roll = Math.random();

            if (roll < 0.3) {
                // 1. Look around (simulated 30% chance)
                await this.lookAround();
            } else if (roll < 0.5) {
                // 2. Crouch check (20% chance)
                this.bot.setControlState('sprint', false);
                this.bot.setControlState('sneak', true);
                await new Promise(r => setTimeout(r, 500));
                this.bot.setControlState('sneak', false);
            } else if (roll < 0.6) {
                // 3. Jump (10% chance - boredom)
                this.bot.setControlState('jump', true);
                await new Promise(r => setTimeout(r, 200));
                this.bot.setControlState('jump', false);
            } else {
                // 4. Do nothing (Stand still is also human)
            }
        } catch (e) {
            console.error("[Idle] Fidget Error:", e);
        } finally {
            this.isFidgeting = false;
        }
    }

    async lookAround() {
        if (this.botCore.humanizer) {
            // Random yaw/pitch within reason
            const yaw = this.bot.entity.yaw + (Math.random() - 0.5);
            const pitch = (Math.random() - 0.5) * 0.5; // Don't look too high/low
            // We can't use look at directly without vector, so this is a placeholder
            // Real implementation would use lookAt point
        }
    }
}

module.exports = HumanIdle;
