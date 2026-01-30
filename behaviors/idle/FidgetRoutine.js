class FidgetRoutine {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.interval = null;
        this.running = false;
    }

    start() {
        if (this.running) return;
        this.running = true;
        console.log("[FidgetRoutine] Started anti-AFK behavior");

        // Random check every 5-15 seconds
        const nextTime = () => 5000 + Math.random() * 10000;

        const tick = async () => {
            if (!this.running || !this.bot) return;

            // Only fidget if NOT doing something else
            if (this.bot.pathfinder?.isMoving()) {
                this.interval = setTimeout(tick, nextTime());
                return;
            }

            const action = Math.random();
            try {
                if (action < 0.4) {
                    // Look around
                    const yaw = this.bot.entity.yaw + (Math.random() - 0.5);
                    const pitch = (Math.random() - 0.5) * 0.5; // Slight up/down
                    await this.bot.look(yaw, pitch); // Smooth? Use humanizer if available
                    if (this.botCore.humanizer) {
                        // Use humanizer smooth look logic
                    }
                } else if (action < 0.6) {
                    // Jump
                    this.bot.setControlState('jump', true);
                    await new Promise(r => setTimeout(r, 100));
                    this.bot.setControlState('jump', false);
                } else if (action < 0.7) {
                    // Swing arm
                    this.bot.swingArm();
                } else if (action < 0.8) {
                    // Sneak
                    this.bot.setControlState('sneak', true);
                    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
                    this.bot.setControlState('sneak', false);
                }
            } catch (e) {
                // Ignore errors (bot might have died/disconnected)
            }

            this.interval = setTimeout(tick, nextTime());
        };

        this.interval = setTimeout(tick, nextTime());
    }

    stop() {
        this.running = false;
        if (this.interval) clearTimeout(this.interval);
    }
}

module.exports = FidgetRoutine;
