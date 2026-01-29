class AdvancedPVP {
    constructor(botCore) {
        this.botCore = botCore;
        // this.bot = botCore.bot; // Removed: was null at init

        this.isCritJumping = false;
        this.lastAttackTime = 0;
    }

    get bot() { return this.botCore.bot; }

    // --- MAIN ATTACK LOGIC ---
    async attack(target) {
        if (!target || !this.bot.entity) return;

        // 1. Equip Weapon (Best Sword/Axe)
        await this.equipBestWeapon();

        // 2. Approach Logic
        const dist = this.bot.entity.position.distanceTo(target.position);
        if (dist > 3) {
            this.bot.lookAt(target.position.offset(0, 1.6, 0));
            this.bot.setControlState('sprint', true);
            this.bot.setControlState('forward', true);
            if (this.bot.entity.isCollidedHorizontally) this.bot.setControlState('jump', true);
            return; // Too far to hit
        }

        // 3. CRITICAL HIT LOGIC (Crit Jump)
        // Only jump if on ground and not already jumping
        if (this.bot.entity.onGround && !this.isCritJumping) {
            this.isCritJumping = true;
            this.bot.setControlState('jump', true);
            // Wait for falling phase (approx 250ms after jump start)
            await new Promise(r => setTimeout(r, 250));
            this.bot.setControlState('jump', false);
        }

        // Wait until we are falling (oy < 0) for critical hit, or close enough
        if (this.bot.entity.velocity.y < -0.1 || this.bot.entity.onGround) {
            // Attack Speed Cooldown check (roughly 600ms for sword)
            const now = Date.now();
            if (now - this.lastAttackTime > 600) {
                await this.bot.lookAt(target.position.offset(0, 1.6, 0));
                this.bot.attack(target);
                this.lastAttackTime = now;
                this.isCritJumping = false; // Reset jump flag

                // 4. W-TAP LOGIC (Knockback)
                // Stop sprinting for 50ms right after hit to reset knockback
                this.bot.setControlState('sprint', false);
                this.bot.setControlState('forward', false);
                await new Promise(r => setTimeout(r, 50));
                this.bot.setControlState('forward', true);
                this.bot.setControlState('sprint', true);
            }
        }
    }

    // --- DEFENSE LOGIC ---
    async smartShield(target) {
        // Shield if target is looking at us and close
        if (!target) return;

        // ... Logic for checking target's yaw/pitch facing us ...
        // For MVP, just shield if they are < 4 blocks and we are not attacking
        const dist = this.bot.entity.position.distanceTo(target.position);
        if (dist < 4 && Date.now() - this.lastAttackTime > 400) {
            this.bot.activateItem(true); // Right click offhand (shield)
        } else {
            this.bot.deactivateItem();
        }
    }

    // --- UTILS ---
    async equipBestWeapon() {
        const items = this.bot.inventory.items();
        const sword = items.find(i => i.name.includes('sword'));
        const axe = items.find(i => i.name.includes('axe'));

        if (sword) await this.bot.equip(sword, 'hand');
        else if (axe) await this.bot.equip(axe, 'hand');
    }
}

module.exports = AdvancedPVP;
