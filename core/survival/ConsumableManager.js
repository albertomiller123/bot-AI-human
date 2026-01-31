const Vec3 = require('vec3');

class ConsumableManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.checkInterval = null;
        this.isCombatMode = false;

        // Configuration
        this.config = {
            lowHealthThreshold: 8, // Hearts (16 HP) = eat gapple? No, HP is 0-20. 8 HP = 4 hearts.
            criticalHealthThreshold: 6, // 3 hearts
            checkFrequency: 50 // ms (20 ticks per second = 50ms)
        };
    }

    get bot() { return this.botCore.bot; }

    start() {
        if (this.checkInterval) return;
        console.log('[ConsumableManager] Started (20 TPS check).');
        this.checkInterval = setInterval(() => this.tick(), this.config.checkFrequency);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async tick() {
        if (!this.bot || !this.bot.entity) return;

        // HIGH PRIORITY: Auto-Totem
        // If offhand is empty OR not holding totem, AND we have one, equip it.
        // But we need to balance with Shield/Gapple?
        // Rule: Always hold Totem if health < critical OR if we just popped one.
        // Actually, "Pro" players hold Totem in offhand almost always in Crystal PVP.
        // Or hold Shield if Axe PVP.

        // For now: Always prefer Totem in offhand if available.
        await this.checkOffhand();

        // Emergency Heal (Potion)
        if (this.bot.health < this.config.criticalHealthThreshold) {
            await this.emergencyHeal();
        }
    }

    async checkOffhand() {
        const offhandItem = this.bot.inventory.slots[45]; // 45 is offhand slot
        const totem = this.findItem('totem_of_undying');

        // 1. If Holding Totem -> Good.
        if (offhandItem && offhandItem.name === 'totem_of_undying') return;

        // 2. If Not holding Totem, and we have one -> Equip it INSTANTLY.
        // Note: bot.equip is async. In a high-speed loop, we must be careful not to spam.
        // But for Totem, spamming equip is better than dying.
        if (totem) {
            // Using fast equip if possible.
            // mineflayer's equip might be slow.
            // Low-level inventory click might be faster?
            // Sticking to standard equip for stability first.
            try {
                // If we are doing something else (eating), we might fail.
                await this.bot.equip(totem, 'off-hand');
            } catch (e) {
                // Ignore "already equipping" errors
            }
        } else {
            // No totem? Fallback to Shield or Food
            this.equipFallbackOffhand();
        }
    }

    async equipFallbackOffhand() {
        // If combat mode, Shield.
        // If safe, Food (for auto-eat) or Torch.
        // Check CombatModule state?
        // We'll read a flag or simple heuristic (nearby enemies).

        const enemies = this.botCore.behaviors.combat ? this.botCore.behaviors.combat.getNearbyEnemies() : []; // Pseudo-code
        // Assuming we can detect combat. For now, simple fallback.

        const shield = this.findItem('shield');
        if (shield) {
            const offhand = this.bot.inventory.slots[45];
            if (!offhand || offhand.name !== 'shield') {
                try { await this.bot.equip(shield, 'off-hand'); } catch (e) { }
            }
        }
    }

    async emergencyHeal() {
        // Splash Potion Logic
        // Look down -> Throw
        const potion = this.bot.inventory.items().find(i => i.name.includes('splash_potion') && (i.nbt?.value?.Potion?.value?.includes('healing') || i.name.includes('healing')));

        if (potion) {
            console.log("[Survival] 🚑 Emergency Potion!");
            const oldYaw = this.bot.entity.yaw;
            const oldPitch = this.bot.entity.pitch;

            await this.bot.look(oldYaw, -Math.PI / 2, true); // Look down
            await this.bot.equip(potion, 'hand');
            this.bot.activateItem(); // Throw
            await this.bot.look(oldYaw, oldPitch, true); // Restore look
        }
    }

    findItem(namePartial) {
        return this.bot.inventory.items().find(i => i.name.includes(namePartial));
    }
}

module.exports = ConsumableManager;
