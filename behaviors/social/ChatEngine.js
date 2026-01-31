const LieLedger = require('../../core/social/LieLedger');
const SocialGraph = require('../../core/social/SocialGraph');
const SocialFilter = require('../../core/social/SocialFilter');

const Typos = require('../../core/humanizer/Typos');

class ChatEngine {
    constructor(botCore) {
        this.botCore = botCore;
        this.messageHistory = [];
        this.isProcessing = false;

        // Social Brain v2
        this.lieLedger = new LieLedger();
        this.socialGraph = new SocialGraph();
        this.socialFilter = new SocialFilter(this.socialGraph);
        this.typos = new Typos();

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
        const survival = this.botCore.survivalSystem;
        const butler = survival?.butler;
        const goalManager = this.botCore.goalManager;

        switch (cmd) {
            case 'come':
            case 'theo':
                if (butler) return await butler.comeToOwner(username);
                break;
            case 'sethome':
            case 'nha':
                if (butler) return butler.setHome();
                break;

            // DEBUG COMMANDS 
            case 'stop':
            case 'dung':
                if (goalManager) {
                    await goalManager.stopCurrentGoal();
                    this.botCore.say("Dung roi.");
                    return true;
                }
                return await butler?.stop();

            case 'status':
                if (goalManager) {
                    const goal = goalManager.activeGoal;
                    const state = this.botCore.survivalSystem?.stateStack?.getCurrent();
                    let msg = `Goal: ${goal ? goal.id : 'Idle'} (Prio: ${goal ? goal.priority : 0})`;
                    if (state) msg += ` | State: ${state.name}`;
                    this.botCore.say(msg);
                    return true;
                }
                break;

            case 'inventory':
            case 'inv':
                const items = this.botCore.bot.inventory.items().map(i => `${i.name}x${i.count}`).join(', ');
                this.botCore.say(items.substring(0, 100) || "Empty."); // Limit length
                return true;

            default:
                return null;
        }
        return null;
    }

    async simulateTyping(text) {
        // 1. Humanize (Add typos)
        let finalText = text;
        let correction = null;

        if (this.typos && Math.random() < 0.1) { // 10% chance to typo
            finalText = this.typos.humanize(text, 1.0); // Force typo if check passes
            if (finalText !== text && this.typos.shouldCorrect()) {
                correction = "*" + text;
            }
        }

        // 2. Variable Delay (WPM simulation)
        // Avg typing speed: 200 CPM ~ 3-4 chars per 100ms
        const delay = Math.max(500, finalText.length * 50);
        await new Promise(r => setTimeout(r, delay));

        if (this.bot) this.bot.chat(finalText);

        if (correction) {
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            if (this.bot) this.bot.chat(correction);
        }
    }
}

module.exports = ChatEngine;
