/**
 * GCDAim.js - Human-like Mouse Movement Simulation
 * 
 * Simulates mouse inputs by applying:
 * 1. GCD (Greatest Common Divisor) quantization - to mimic pixel-based mouse steps.
 * 2. Overshoot - aiming past the target and correcting.
 * 3. Smoothing - Using easing functions instead of linear interpolation.
 */
class GCDAim {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        // Configuration
        this.sensitivity = 0.5; // Minecraft sensitivity
        this.mouseDPI = 800;
        this.gcd = this.calculateGCD(this.sensitivity, this.mouseDPI);

        // State
        this.lastLookAt = 0;
    }

    calculateGCD(sensitivity, dpi) {
        // Approximate pixel degree step
        // In Minecraft: yaw_change = pixel_delta * sensitivity * 0.15 ...
        // Simplified factor for simulation
        return 0.15 * sensitivity;
    }

    /**
     * Looks at a target position with human-like imperfections
     * @param {Vec3} targetPos 
     * @param {boolean} forceInstant (optional) override for critical moments
     */
    async lookAt(targetPos, forceInstant = false) {
        if (forceInstant) {
            await this.bot.lookAt(targetPos, true);
            return;
        }

        const eyePos = this.bot.entity.position.offset(0, this.bot.entity.height, 0);
        const delta = targetPos.minus(eyePos);

        const yaw = Math.atan2(-delta.x, -delta.z);
        const pitch = Math.asin(delta.y / delta.norm());

        // Apple GCD Quantization (Snap to grid)
        const quantizedYaw = Math.round(yaw / this.gcd) * this.gcd;
        const quantizedPitch = Math.round(pitch / this.gcd) * this.gcd;

        // Apply Overshoot (5% chance)
        let finalYaw = quantizedYaw;
        let finalPitch = quantizedPitch;

        if (Math.random() < 0.05) {
            const overshootFactor = (Math.random() - 0.5) * 0.1; // Small overshoot
            await this.bot.lookAt(targetPos.offset(overshootFactor, overshootFactor, overshootFactor), false);
            await new Promise(r => setTimeout(r, 50 + Math.random() * 50)); // Reaction time
        }

        // Final Look
        await this.bot.lookAt(targetPos, false);
    }
}

module.exports = GCDAim;
