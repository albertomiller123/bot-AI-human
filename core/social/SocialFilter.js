/**
 * SocialFilter.js
 * The "Bouncer" of the bot's social interactions.
 * Decides WHO to reply to and HOW.
 */
class SocialFilter {
    constructor(socialGraph) {
        this.socialGraph = socialGraph;
        this.myUsername = ""; // Will be set on init
    }

    setBotName(name) {
        this.myUsername = name;
    }

    /**
     * Decision Logic
     * @returns {Object} { action: 'reply' | 'ignore' | 'deflect' | 'execute', reason: string }
     */
    decide(username, message, isWhisper) {
        const role = this.socialGraph.getRole(username);
        const lowerMsg = message.toLowerCase();
        const mentioned = lowerMsg.includes(this.myUsername.toLowerCase());

        // 1. OWNER - Absolute Authority
        if (role === 'owner') {
            // Assume almost everything from owner is a command or priority chat
            return { action: 'execute', reason: 'owner_command' };
        }

        // 2. TRUSTED - High Priority
        if (role === 'trusted') {
            return { action: 'reply', reason: 'trusted_friend' };
        }

        // 3. STRANGER
        // Only reply if directly addressed or whispered
        if (isWhisper || mentioned) {
            // Random chance to ignore or deflect if busy (simulated)
            // But for Phase 1 MVP, let's reply but keep it brief? 
            // User requested: "Selective Hearing"

            // If they are asking for resources/help -> Deflect
            if (this.isRequest(message)) {
                return { action: 'deflect', reason: 'stranger_begging' };
            }

            return { action: 'reply', reason: 'mentioned_by_stranger' };
        }

        // 4. Noise (Public chat not addressed to bot)
        return { action: 'ignore', reason: 'noise' };
    }

    isRequest(message) {
        const triggers = ['cho', 'give', 'vứt', 'xin', 'help', 'giúp', 'tps', 'lag', 'cần'];
        return triggers.some(t => message.toLowerCase().includes(t));
    }
}

module.exports = SocialFilter;
