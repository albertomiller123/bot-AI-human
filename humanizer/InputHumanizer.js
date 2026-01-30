class InputHumanizer {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        // Register globally for other modules
        this.botCore.humanizer = this;

        // Config
        this.typoChance = 0.05; // 5% char swap
        this.wpm = 90; // Average typing speed
    }

    /**
     * Introduces human-like typos and case errors
     */
    processText(text) {
        if (!text) return "";
        let chars = text.split('');

        // 1. Random lowercase start (20% chance)
        if (Math.random() < 0.2 && chars.length > 0) {
            chars[0] = chars[0].toLowerCase();
        }

        // 2. Typos (Swap adjacent chars)
        for (let i = 0; i < chars.length - 1; i++) {
            if (Math.random() < this.typoChance) {
                const temp = chars[i];
                chars[i] = chars[i + 1];
                chars[i + 1] = temp;
                i++; // Skip next to avoid double swap
            }
        }

        // 3. Missed punctuation (remove trailing period)
        if (text.endsWith('.') && Math.random() < 0.5) {
            chars.pop();
        }

        return chars.join('');
    }

    /**
     * Calculates realistic typing delay
     */
    calculateDelay(text) {
        const charDelay = (60000 / (this.wpm * 5)); // ms per char
        const baseDelay = text.length * charDelay;
        const randomness = (Math.random() * 500) - 250; // +/- 250ms
        return Math.max(500, baseDelay + randomness); // Min 500ms
    }

    /**
     * Human-like chat interaction
     */
    async say(text) {
        const humanized = this.processText(text);
        const delay = this.calculateDelay(text);

        // Simulate "typing..." (optional: could emit event)
        // console.log(`[Humanizer] Typing... (${Math.round(delay)}ms): ${humanized}`);

        await new Promise(r => setTimeout(r, delay));
        this.botCore.say(humanized);
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
        const pitch = Math.atan2(delta.y, groundDist); // Fixed pitch calc (was -y usually for Minecraft but verify lib)

        // Standardize angles
        // ... (simplified for now)

        await this.bot.look(yaw, pitch, true); // Force instant for now until smooth vector math is validated
    }
}

module.exports = InputHumanizer;
