// humanizer.js (Tier 3 & Human Error Simulation logic)

class Humanizer {
    constructor() {
        // Probability of mistake (0.0 to 1.0)
        // Reduced from 0.05/0.1 to 0.01 for readability
        this.mistakeProbability = 0.01;
        this.typoProbability = 0.01;
    }

    // --- CHAT HUMANIZATION ---

    humanize_chat(message) {
        if (message.startsWith('/') || message.startsWith('!')) return message; // Don't mess up commands

        let text = message;

        // 1. Lowercase (Gamers rarely cap, but don't force it 90% of time)
        if (Math.random() < 0.2) text = text.toLowerCase();

        // 2. Remove punctuation
        if (Math.random() < 0.8) {
            text = text.replace(/[.,;!?]/g, "");
        }

        // 3. Add Typos
        text = text.split('').map(char => {
            if (Math.random() < this.typoProbability) {
                const nearbyKeys = {
                    'a': 's', 's': 'd', 'd': 'f', 'f': 'g',
                    'q': 'w', 'w': 'e', 'e': 'r', 'r': 't',
                    'o': 'p', 'p': 'o', 'k': 'l', 'l': 'k'
                };
                return nearbyKeys[char.toLowerCase()] || char;
            }
            return char;
        }).join('');

        return text;
    }

    // --- TIMING ---

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async random_delay(min_ms, max_ms) {
        const delay = Math.floor(Math.random() * (max_ms - min_ms + 1)) + min_ms;
        await this.delay(delay);
    }

    async hesitate(seconds = 1) {
        await this.random_delay(seconds * 1000 * 0.5, seconds * 1000 * 1.5);
    }

    // --- HUMAN ERROR SIMULATION ---

    should_make_mistake() {
        return Math.random() < this.mistakeProbability;
    }

    async fake_afk(botCore, seconds) {
        botCore.say("AFK mot chut...");
        botCore.primitives.stop();

        const startTime = Date.now();
        const duration = seconds * 1000;

        while (Date.now() - startTime < duration) {
            // Randomly look around slightly while AFK
            if (Math.random() < 0.3) {
                await botCore.primitives.look_random();
            }
            await this.delay(2000);
        }
        botCore.say("Da quay lai!");
    }
    // --- ADVANCED ERROR SIMULATION ---

    async repeat_action_unnecessarily(actionFn, times = 1) {
        // Human error: Clicking twice or repeating an action casually
        if (Math.random() < this.mistakeProbability) {
            for (let i = 0; i < times; i++) {
                await actionFn();
                await this.delay(200);
            }
        }
        // Always do it at least once (the intended action)
        await actionFn();
    }

    async cancel_then_retry_action(actionFn) {
        // Human error: Start doing something, stop, then restart
        if (Math.random() < this.mistakeProbability) {
            // Start...
            await this.delay(500);
            // Stop/Cancel mentally
            await this.delay(1000);
            // Retry
            await actionFn();
        } else {
            await actionFn();
        }
    }
}

module.exports = new Humanizer();
