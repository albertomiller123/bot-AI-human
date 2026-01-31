const Vec3 = require('vec3');

class PhysicsManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.monitorInterval = null;
        this.isFalling = false;
        this.fallStartY = null;
    }

    get bot() { return this.botCore.bot; }

    start() {
        if (this.monitorInterval) return;
        this.monitorInterval = setInterval(() => this.tick(), 50);
        console.log('[PhysicsManager] Gravity Monitor Started.');
    }

    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    async tick() {
        if (!this.bot || !this.bot.entity) return;

        // Detect Falling
        if (this.bot.entity.velocity.y < -0.1) { // Falling down
            if (!this.isFalling) {
                this.isFalling = true;
                this.fallStartY = this.bot.entity.position.y;
            }

            // Calculate potential fall damage distance
            const currentFallDist = this.fallStartY - this.bot.entity.position.y;

            if (currentFallDist > 3.5) {
                // Dangerous fall
                await this.attemptMLG();
            }
        } else {
            // Reset
            if (this.bot.entity.onGround || this.bot.entity.isInWater) {
                this.isFalling = false;
                this.fallStartY = null;
            }
        }
    }

    async attemptMLG() {
        console.log("PhysicsManager: attemptMLG called");
        console.log("Vec3 type:", typeof Vec3);
        try {
            console.log("Vec3 constructor check:", new Vec3(0, 0, 0));
        } catch (e) {
            console.log("Vec3 failed:", e);
        }

        // Look for ground
        const ground = this.bot.blockAt(this.bot.entity.position.offset(0, -3, 0));
        // Simple raycast check: is there a solid block soon?
        // We predict collision. 

        // simplified: If velocity suggests impact in < 0.5s

        const bucket = this.bot.inventory.items().find(i => i.name === 'water_bucket');
        if (!bucket) { console.log("No bucket"); return; }

        console.log("Calling Raycast...");
        // Raycast down
        const ray = this.bot.world.raycast(this.bot.entity.position, new Vec3(0, -1, 0), 5);
        console.log("Raycast result:", ray);

        if (ray && ray.intersect) {
            const hitPos = ray.intersect;
            const dist = this.bot.entity.position.distanceTo(hitPos); // dist to visual impact

            if (dist < 4) {
                // IMPACT IMMINENT
                console.log(`[Physics] MLG! Dist: ${dist.toFixed(1)}`);

                // 1. Equip Bucket
                await this.bot.equip(bucket, 'hand');

                // 2. Look Down
                await this.bot.lookAt(hitPos, true); // Instant

                // 3. Right Click (Place)
                // Need to aim at the block SURFACE
                // ray.position is the block coordinate. ray.face is the face.
                const refBlock = this.bot.blockAt(ray.position);
                await this.bot.activateItem(); // Use bucket? Or placeBlock?
                // activateItem uses hand item. If looking at block, might simple use it.
                // Correct is bot.placeBlock(refBlock, ray.face) but that requires precise face.

                // "activateItem" is safer for "Use" action (Right click).
                // Timing is crucial.

                // 4. Pickup Water (Clean up)?
                // Wait for land
                setTimeout(() => this.cleanupWater(), 1000);
            }
        }
    }

    async cleanupWater() {
        // If we are in water, pickup.
        if (this.bot.blockAt(this.bot.entity.position).name === 'water') {
            const buckets = this.bot.inventory.items().find(i => i.name === 'bucket');
            if (buckets) {
                await this.bot.equip(buckets, 'hand');
                await this.bot.activateItem(); // Scoop
                console.log("[Physics] MLG Cleanup done.");
            }
        }
    }
}

module.exports = PhysicsManager;
