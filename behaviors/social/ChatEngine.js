const LieLedger = require('../../core/social/LieLedger');
const SocialGraph = require('../../core/social/SocialGraph');
const SocialFilter = require('../../core/social/SocialFilter');

class ChatEngine {
    constructor(botCore) {
        this.botCore = botCore;
        this.messageHistory = [];
        this.isProcessing = false;

        // Social Brain v2
        this.lieLedger = new LieLedger();
        this.socialGraph = new SocialGraph();
        this.socialFilter = new SocialFilter(this.socialGraph);

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

        // Init Filter Name
        if (!this.socialFilter.myUsername) this.socialFilter.setBotName(this.bot.username);

        // Update Social Graph
        this.socialGraph.updateInteraction(username, 'chat');

        // Log to Core Cognitive (Optional)
        if (this.botCore.survivalSystem && this.botCore.survivalSystem.cognitive) {
            this.botCore.survivalSystem.cognitive.logExperience('Chat', `${username}: ${message}`);
        }

        this.chatHistory.push({ role: 'user', content: `${username}: ${message}` });
        if (this.chatHistory.length > 10) this.chatHistory.shift();

        // 1. Social Filter Decision
        const decision = this.socialFilter.decide(username, message, false); // Assuming public chat is not whisper
        console.log(`[Social] Decision for ${username}: ${decision.action} (${decision.reason})`);

        if (decision.action === 'ignore') return;

        if (decision.action === 'deflect') {
            await this.simulateTyping(this.getDeflection());
            return;
        }

        if (decision.action === 'execute') {
            // Check if message is a command
            const cmdMatch = message.match(/^\/(\w+)/) || message.match(/^!(\w+)/) || message.match(/^(\w+)$/);
            // Simple command parsing: "come", "/come", "!come"
            if (cmdMatch) {
                const cmd = cmdMatch[1].toLowerCase();
                if (await this.handleCommand(cmd, username)) return;
            }
            // If not a command, fall through to reply (Owner chatting normally)
        }

        // 2. Generate Reply using LLM + Lie Ledger
        const facts = this.lieLedger.getFacts(username).map(f => f.text).join('; ');
        const reply = await this.generateReply(username, message, facts);

        if (reply) {
            await this.simulateTyping(reply);
            // Record what we said to keep our story straight
            this.lieLedger.addFact(username, reply);
        }
    }

    getDeflection() {
        const excuses = [
            "lag qua", "dang ban ti", "full ruong roi", "doi ti", "...", "dang qua map khac", "lag ko nghe gi"
        ];
        return excuses[Math.floor(Math.random() * excuses.length)];
    }

    setMemory(memory) {
        this.memory = memory;
    }

    async generateReply(username, message, knownFacts) {
        // Phase 10: Dynamic Persona based on Relationship
        let personaType = this.persona.type;
        const role = this.socialGraph.getRole(username);

        if (role === 'owner') personaType = 'friendly'; // Always nice to boss
        if (role === 'trusted') personaType = 'friendly';

        // MVP: Simple mocked response since we haven't integrated full LLM prompt builder here
        // In real version, we would inject `knownFacts` into the prompt.

        const responses = {
            toxic: ["?", "ga", "cut", "ai hoi?", "tuoi?", "solo ko?", "m is nothing", "ez"],
            friendly: ["hi bestie", "hello friend", "can i help u?", "want some food?", "<3", "ok bro"],
            noob: ["how to craft?", "lag qua", "where am i?", "help", "who r u?"]
        };

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

    const Typos = require('../../core/humanizer/Typos');

class ChatEngine {
    constructor(botCore) {
        // ... previous init ...
        this.typos = new Typos();
        // ...
    }

    async simulateTyping(text) {
        // 1. Humanize (Add typos)
        let finalText = text;
        let correction = null;

        if (Math.random() < 0.1) { // 10% chance to typo
            finalText = this.typos.humanize(text, 1.0); // Force typo if check passes
            if (finalText !== text && this.typos.shouldCorrect()) {
                correction = "*" + text;
            }
        }

        // 2. Variable Delay (WPM simulation)
        // Avg typing speed: 200 CPM ~ 3-4 chars per 100ms
        const delay = Math.max(500, finalText.length * 50);
        await new Promise(r => setTimeout(r, delay));

        this.bot.chat(finalText);

        if (correction) {
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            this.bot.chat(correction);
        }
    }
}
}

module.exports = ChatEngine;
