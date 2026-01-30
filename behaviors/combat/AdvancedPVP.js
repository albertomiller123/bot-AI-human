/**
 * AdvancedPVP.js - Advanced Combat System
 * 
 * FIX: Dynamic target height based on entity.height (not hardcoded 1.6m)
 * FIX: Smart shield that checks for axe-disabled cooldown
 */
class AdvancedPVP {
    constructor(botCore) {
        this.botCore = botCore;
        this.isCritJumping = false;
        this.lastAttackTime = 0;
        this.shieldDisabledUntil = 0;

        // Auto-detect shield disable (Axe hit) - Moved to start()
        this.shieldListener = null;
    }

    start() {
        if (this.shieldListener) return; // Already started

        console.log("[PVP] AdvancedPVP started.");

        // Auto-detect shield disable (Axe hit)
        this.shieldListener = (entity, status) => {
            if (entity.id === this.bot.entity.id && status === 30) {
                // Status 30 = Shield Disabled (approx 5 seconds / 100 ticks)
                console.log("[PVP] 🛡️ Shield DISABLED by Axe!");
                this.shieldDisabledUntil = Date.now() + 5000;
            }
        };
        this.bot.on('entityStatus', this.shieldListener);
    }

    stop() {
        if (this.shieldListener) {
            this.bot.removeListener('entityStatus', this.shieldListener);
            this.shieldListener = null;
        }
    }

    get bot() { return this.botCore.bot; }

    // --- MAIN ATTACK LOGIC ---
    async attack(target) {
        if (!target || !this.bot.entity) return;

        await this.equipBestWeapon();

        const dist = this.bot.entity.position.distanceTo(target.position);

        // FIX 1: Look at target's HEAD based on their actual height
        // target.height * 0.85 = approximate head/neck position for any mob
        // This works for Spiders (0.9m), Baby Zombies (0.975m), Crouching players, etc.
        const targetHead = target.position.offset(0, (target.height || 1.8) * 0.85, 0);
        await this.bot.lookAt(targetHead);

        if (dist > 3.5) {
            this.bot.setControlState('sprint', true);
            this.bot.setControlState('forward', true);
            if (this.bot.entity.isCollidedHorizontally) this.bot.setControlState('jump', true);
            return; // Too far to hit
        }

        // Critical Hit Logic (Crit Jump) with Physics Sync
        if (this.bot.entity.onGround && !this.isCritJumping && dist < 3) {
            this.isCritJumping = true;
            this.bot.setControlState('jump', true);

            // Wait for "falling" state (velocity.y < -0.1) for critical hit
            // This syncs with server ticks instead of real-time ms
            this.waitForFall().then(() => {
                this.bot.setControlState('jump', false);
                // Race Condition Check: Ensure target still exists and is close
                if (target && target.isValid) {
                    const newDist = this.bot.entity.position.distanceTo(target.position);
                    this._performAttack(target, newDist);
                }
            });
            return;
        }

        // Standard attack (if not jumping or already failing)
        this._performAttack(target, dist);
    }

    // Helper: Wait until bot starts falling (indicating apex reached)
    async waitForFall() {
        return new Promise(resolve => {
            const check = () => {
                if (this.bot.entity.velocity.y < -0.05) { // Started falling
                    this.bot.removeListener('physicsTick', check);
                    resolve();
                } else if (this.bot.entity.onGround) { // Landed early?
                    this.bot.removeListener('physicsTick', check);
                    resolve();
                }
            };
            this.bot.on('physicsTick', check);
            // Fallback timeout to prevent hanging listener
            setTimeout(() => {
                this.bot.removeListener('physicsTick', check);
                resolve();
            }, 1000);
        });
    }

    async _performAttack(target, dist) {
        if (this.bot.entity.velocity.y < -0.1 || this.bot.entity.onGround || dist < 2) {
            const now = Date.now();
            // Sword attack cooldown (~600ms)
            if (now - this.lastAttackTime > 600) {
                this.bot.attack(target);
                this.lastAttackTime = now;
                this.isCritJumping = false;

                // W-Tap Logic (Reset Knockback for more KB)
                this.bot.setControlState('sprint', false);
                // Use a quick tick-wait instead of pure sleep if possible, but sleep is okay for sprint reset
                await new Promise(r => setTimeout(r, 50));
                this.bot.setControlState('sprint', true);
            }
        }
    }

    // --- DEFENSE LOGIC ---
    async smartShield(target) {
        if (!target) return;

        // FIX 2: Check if shield is on cooldown (disabled by axe hit)
        if (Date.now() < this.shieldDisabledUntil) {
            // Shield is disabled, don't try to use it
            this.bot.deactivateItem();
            return;
        }

        // For safety, check if we have a shield equipped and it's usable
        const offhand = this.bot.inventory.slots[45]; // Offhand slot
        const hasShield = offhand && offhand.name.includes('shield');

        if (!hasShield) {
            this.bot.deactivateItem();
            return;
        }

        const dist = this.bot.entity.position.distanceTo(target.position);

        const isSprinting = this.bot.entity.controlState['sprint'];

        // FIX: If sprinting (chasing) and health is decent, DO NOT shield (it slows you down)
        if (isSprinting && this.bot.health > 10) {
            this.bot.deactivateItem();
            return;
        }

        // Only shield when enemy is close and we're not in attack cooldown
        if (dist < 4 && Date.now() - this.lastAttackTime > 300) {
            this.bot.activateItem(true); // Right click offhand (shield)
        } else {
            this.bot.deactivateItem();
        }
    }

    // --- UTILS ---
    async equipBestWeapon() {
        const items = this.bot.inventory.items();
        // Priority: Sword > Axe (swords have faster attack speed)
        const sword = items.find(i => i.name.includes('sword'));
        const axe = items.find(i => i.name.includes('axe'));

        if (sword) await this.bot.equip(sword, 'hand');
        else if (axe) await this.bot.equip(axe, 'hand');
    }
}

module.exports = AdvancedPVP;
