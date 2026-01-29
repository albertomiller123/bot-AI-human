class InputHumanizer {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
    }

    // Bezier curve mouse movement
    async smoothLookAt(targetPos) {
        const start = {
            yaw: this.bot.entity.yaw,
            pitch: this.bot.entity.pitch
        };

        // Calculate needed yaw/pitch
        const lookingAt = this.bot.entity.position.offset(0, 1.6, 0);
        const delta = targetPos.minus(lookingAt);
        const yaw = Math.atan2(-delta.x, -delta.z);
        const groundDist = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
        const pitch = Math.atan2(delta.y, groundDist);

        // Interpolate
        const steps = 10 + Math.random() * 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Simple linear for MVP, but add noise
            const curYaw = start.yaw + (yaw - start.yaw) * t + (Math.random() - 0.5) * 0.1;
            const curPitch = start.pitch + (pitch - start.pitch) * t + (Math.random() - 0.5) * 0.1;

            await this.bot.look(curYaw, curPitch, true);
            await new Promise(r => setTimeout(r, 20)); // 20ms delay
        }
    }
}

module.exports = InputHumanizer;
