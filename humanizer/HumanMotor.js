const { Vec3 } = require('vec3');

class HumanMotor {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Smoothly look at a target position using Bezier curves to simulate mouse movement.
     * @param {Vec3} targetPos - The position to look at
     * @param {number} timeMs - Duration of the look action in ms (approx)
     */
    async smoothLookAt(targetPos, timeMs = 500) {
        return new Promise((resolve) => {
            const botPos = this.bot.entity.position.offset(0, this.bot.entity.height, 0);
            const delta = targetPos.minus(botPos);

            const targetYaw = Math.atan2(-delta.x, -delta.z);
            const groundDist = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
            const targetPitch = Math.atan2(delta.y, groundDist);

            const startYaw = this.bot.entity.yaw;
            const startPitch = this.bot.entity.pitch;

            // Shortest arc calculation works
            let diffYaw = targetYaw - startYaw;
            while (diffYaw > Math.PI) diffYaw -= 2 * Math.PI;
            while (diffYaw < -Math.PI) diffYaw += 2 * Math.PI;

            const diffPitch = targetPitch - startPitch;

            const steps = Math.floor(timeMs / 50); // Physics ticks (50ms)
            let currentStep = 0;

            const onTick = () => {
                currentStep++;
                if (currentStep > steps) {
                    this.bot.removeListener('physicsTick', onTick);
                    resolve();
                    return;
                }

                // Bezier Ease-Out-Cubic-ish
                const t = currentStep / steps;

                // Human-like overshoot/settle logic could go here, 
                // but simple cubic ease is good for now.
                // p0=0, p1=0.2, p2=0.9, p3=1
                const p1 = 0.2;
                const p2 = 0.9;

                const t2 = t * t;
                const t3 = t2 * t;
                const ease = 3 * p1 * t * (1 - t) * (1 - t) + 3 * p2 * t2 * (1 - t) + t3;

                const newYaw = startYaw + (diffYaw * ease);
                const newPitch = startPitch + (diffPitch * ease);

                this.bot.look(newYaw, newPitch, true);
            };

            this.bot.on('physicsTick', onTick);
        });
    }

    /**
     * Move to a nearby target with human-like input noise (strafe, slight curves)
     * Not using pathfinder, pure primitive movement.
     */
    async humanRelMove(targetPos, range = 1.0) {
        const target = targetPos.clone();

        // Loop until close enough
        while (this.bot.entity.position.distanceTo(target) > range) {
            // Updated Look
            await this.bot.lookAt(target);
            // Add slight noise to look? 
            // this.bot.look(this.bot.entity.yaw + (Math.random() - 0.5) * 0.2, this.bot.entity.pitch);

            this.bot.setControlState('forward', true);

            // Random Strafe (Fidget)
            if (Math.random() < 0.05) {
                const strafe = Math.random() > 0.5 ? 'left' : 'right';
                this.bot.setControlState(strafe, true);
                setTimeout(() => this.bot.setControlState(strafe, false), 200 + Math.random() * 300);
            }

            // Jump if stuck (simple heuristic)
            if (this.bot.entity.isCollidedHorizontally) {
                this.bot.setControlState('jump', true);
                setTimeout(() => this.bot.setControlState('jump', false), 200);
            }

            await new Promise(r => setTimeout(r, 50)); // Tick wait
        }

        this.bot.clearControlStates();
    }
}

module.exports = HumanMotor;
