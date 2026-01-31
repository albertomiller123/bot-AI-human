const Vec3 = require('vec3');

class CrystalCombat {
    constructor(botCore) {
        this.botCore = botCore;
        this.active = false;
        this.target = null;
    }

    get bot() { return this.botCore.bot; }

    start(target) {
        this.target = target;
        this.active = true;
        this.loop();
    }

    stop() {
        this.active = false;
        this.target = null;
    }

    async loop() {
        if (!this.active || !this.target || !this.target.isValid) return;

        try {
            // 1. Check Distance
            const dist = this.bot.entity.position.distanceTo(this.target.position);
            if (dist > 6) {
                // Too far for crystals, maybe close gap?
                // Left for CombatModule to handle movement.
                // We just stop loop for this tick.
                setTimeout(() => this.loop(), 50);
                return;
            }

            // 2. Crystal Aura Logic
            // A. Find placement spot (Obby/Bedrock near target)
            const spot = this.findCrystalSpot();

            if (spot) {
                // B. Place Crystal
                await this.placeCrystal(spot);

                // C. Break Crystal (Fast)
                // We need to re-find the entity because it just spawned (or will spawn)
                // Actually, we can listen for entitySpawn event or just spam click the block center.
                // Mineflayer sees entities. 
                const crystal = this.findCrystalEntity(spot);
                if (crystal) {
                    await this.breakCrystal(crystal);
                }
            } else {
                // No spot? Check if we have obsidian to place?
                // Advanced: Place obsidian at target feet.
            }

        } catch (e) {
            // Suppress errors to not crash loop
        }

        if (this.active) setTimeout(() => this.loop(), 50); // 20 TPS
    }

    findCrystalSpot() {
        // Find Obsidian/Bedrock with Air above it
        // Sorted by damage ratio (Max dmg to target, Min dmg to self)

        // Simplified MVP: Find any obby/bedrock within 2 blocks of target.
        const targetPos = this.target.position.floored();
        const spots = this.bot.findBlocks({
            matching: block => block.name === 'obsidian' || block.name === 'bedrock',
            maxDistance: 6,
            count: 5
        });

        // Filter spots strictly near target
        // And ensure air above
        const validSpots = spots.filter(pos => {
            const distToTarget = pos.distanceTo(this.target.position);
            const blockAbove = this.bot.blockAt(pos.offset(0, 1, 0));
            // simplified air check
            return distToTarget < 3 && blockAbove && blockAbove.name === 'air';
        });

        // best spot = closest to target
        validSpots.sort((a, b) => a.distanceTo(this.target.position) - b.distanceTo(this.target.position));

        return validSpots.length > 0 ? validSpots[0] : null;
    }

    async placeCrystal(pos) {
        const crystal = this.bot.inventory.items().find(i => i.name === 'end_crystal');
        if (!crystal) return; // Cannot place

        const offhand = this.bot.inventory.slots[45];
        if (offhand && offhand.name === 'end_crystal') {
            // Ready
        } else {
            await this.bot.equip(crystal, 'off-hand'); // Better offhand for instant place
        }

        const block = this.bot.blockAt(pos);
        // Look at block
        await this.bot.lookAt(pos.offset(0.5, 1, 0.5));
        // Place
        await this.bot.activateBlock(block);
    }

    findCrystalEntity(pos) {
        // Find crystal entity at pos.offset(0.5, 1, 0.5)
        return this.bot.nearestEntity(e =>
            e.name === 'end_crystal' && e.position.distanceTo(pos.offset(0.5, 1, 0.5)) < 1.5
        );
    }

    async breakCrystal(entity) {
        // Check health (safety)
        // Need blast calculation logic (prismarine-physics) or simple heuristics
        // Heuristic: If we are lower than crystal, we take less damage (feet protection).
        // Or if we have Totem held.

        // MVP: Just blast it. God mode assumes we have totems.
        await this.bot.attack(entity);
    }
}

module.exports = CrystalCombat;
