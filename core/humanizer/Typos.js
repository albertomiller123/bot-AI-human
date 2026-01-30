/**
 * Typos.js - Simulates Human Typing Errors
 */
class Typos {
    constructor() {
        this.qwertyMap = {
            'q': 'w', 'w': 'e', 'e': 'r', 'r': 't', 't': 'y', 'y': 'u', 'u': 'i', 'i': 'o', 'o': 'p',
            'a': 's', 's': 'd', 'd': 'f', 'f': 'g', 'g': 'h', 'h': 'j', 'j': 'k', 'k': 'l',
            'z': 'x', 'x': 'c', 'c': 'v', 'v': 'b', 'b': 'n', 'n': 'm'
        };
    }

    /**
     * Humanize text with typos
     * @param {string} text 
     * @param {number} chance (0-1)
     * @returns {string} processed text
     */
    humanize(text, chance = 0.05) {
        if (Math.random() > chance) return text;

        const chars = text.split('');
        const errorType = Math.random();

        // 1. Swap adjacent chars (the -> hte)
        if (errorType < 0.3 && chars.length > 2) {
            const idx = Math.floor(Math.random() * (chars.length - 1));
            const temp = chars[idx];
            chars[idx] = chars[idx + 1];
            chars[idx + 1] = temp;
        }
        // 2. Fat Finger (hit neighbor key)
        else if (errorType < 0.6) {
            const idx = Math.floor(Math.random() * chars.length);
            const char = chars[idx].toLowerCase();
            if (this.qwertyMap[char]) {
                chars[idx] = this.qwertyMap[char];
            }
        }
        // 3. Missed Key (drop char)
        else {
            const idx = Math.floor(Math.random() * chars.length);
            chars.splice(idx, 1);
        }

        return chars.join('');
    }

    /**
     * Should we correct the mistake?
     * @returns {boolean}
     */
    shouldCorrect() {
        return Math.random() > 0.4; // 60% chance to correct
    }
}

module.exports = Typos;
