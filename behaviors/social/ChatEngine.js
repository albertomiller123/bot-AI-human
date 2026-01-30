class ChatEngine {
    constructor(botCore) {
        this.botCore = botCore;
        this.messageHistory = [];
        this.isProcessing = false;

        // Persona Configuration
        this.persona = {
            type: 'toxic', // friendly, noob, toxic
            typingSpeed: 100, // ms per char
            typoChance: 0.1
        };

        this.chatHistory = [];
    }

    get bot() { return this.botCore.bot; }

    async handleChat(username, message) {
        if (username === this.bot.username) return;

        // Add to history
        // Log chat to Cognitive System
        if (this.botCore.survivalSystem && this.botCore.survivalSystem.cognitive) {
            this.botCore.survivalSystem.cognitive.logExperience('Chat', `${username}: ${message}`);
        }

        this.chatHistory.push({ role: 'user', content: `${username}: ${message}` });
        if (this.chatHistory.length > 10) this.chatHistory.shift();

        // 1b. Stealth Mode (Phase 13): Disable In-Game Commands
        // We do NOT listen to /cmd in public chat anymore to avoid detection.
        // Commands are only accepted via Web API (handled in web-server.js -> ButlerBehavior)

        /* 
        if (message.startsWith('/')) {
             ... removed ...
        } 
        */

        // 1. Decide if we should reply (not every message needs reply)
        if (!message.toLowerCase().includes(this.bot.username) && Math.random() > 0.3) return;

        // 2. Generate Reply using LLM
        // Mocking LLM call for now if setup is complex, else use shared AI layer logic
        // For MVP, we use simple heuristic + mock
        const reply = await this.generateReply(username, message);

        if (reply) {
            await this.simulateTyping(reply);
        }
    }

    setMemory(memory) {
        this.memory = memory;
    }

    async generateReply(username, message) {
        // Phase 10: Dynamic Persona based on Relationship
        let personaType = this.persona.type; // Default

        if (this.memory) {
            const rel = this.memory.getRelationship(username);
            if (rel === 1) personaType = 'friendly'; // Friend
            if (rel === -1) personaType = 'toxic';   // Nemesis
        }

        const responses = {
            toxic: ["?", "ga", "cut", "ai hoi?", "tuoi?", "solo ko?", "m is nothing", "ez"],
            friendly: ["hi bestie", "hello friend", "can i help u?", "want some food?", "<3"],
            noob: ["how to craft?", "lag qua", "where am i?", "help", "who r u?"]
        };

        // Use friendly as fallback for neutral/noob in default config, or stick to configured persona
        // If relationship is Neutral (0), we stick to `this.persona.type` (which might be 'toxic' or 'noob')

        const palette = responses[personaType] || responses.friendly;
        return palette[Math.floor(Math.random() * palette.length)];
    }

    async handleCommand(cmd, username) {
        // Link to Butler or System
        if (!this.botCore.survivalSystem || !this.botCore.survivalSystem.butler) return null;

        const butler = this.botCore.survivalSystem.butler;

        switch (cmd) {
            case 'come':
            case 'theo':
                return await butler.comeToOwner(username);
            case 'sethome':
            case 'nha':
                return butler.setHome();
            case 'stop':
            case 'dung':
                return await butler.stop();
            default:
                return null;
        }
    }

    async simulateTyping(text) {
        if (this.botCore.humanizer) {
            await this.botCore.humanizer.say(text);
        } else {
            // Fallback
            console.log(`[ChatEngine] Humanizer missing, using instant chat.`);
            this.bot.chat(text);
        }
    }
}

module.exports = ChatEngine;
