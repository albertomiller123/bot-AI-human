const StrategicAgent = require('./StrategicAgent');
const TacticalAgent = require('./TacticalAgent');
const VectorDB = require('../memory/VectorDB');

class AgentOrchestrator {
    constructor(botCore) {
        this.botCore = botCore;
        this.ai = botCore.aiManager; // AIManager from injected dependency

        this.strategic = new StrategicAgent(this.ai);
        this.tactical = new TacticalAgent(this.ai);

        // Memory System
        this.ltm = null;
        this.isProcessing = false; // Prevents race conditions
    }

    async init() {
        // Use shared LTM from BotCore (initialized in index.js)
        this.ltm = this.botCore.ltm;

        if (!this.ltm) {
            console.warn("[AgentOrchestrator] LTM not available in BotCore, falling back...");
            this.ltm = new VectorDB(this.botCore);
            await this.ltm.init();
        }

        console.log("[AgentOrchestrator] Cognitive Architecture Ready (Strict Strategy Mode)");
    }

    /**
     * Called by GoalManager to bid for control
     */
    async getProposal() {
        if (this.activePlan) {
            return {
                id: 'execute_agent_plan',
                priority: 90, // User Command Priority
                execute: async () => {
                    console.log("[Orchestrator] Resuming Active Plan deferred to GoalManager.");
                }
            };
        }
        return null;
    }

    // Set active plan from Chat Input
    setPlan(planSteps) {
        this.activePlan = planSteps;
    }

    /**
     * Main Thinking Loop
     * Returns a Plan Object: { type: 'strategy', steps: [...] }
     * DOES NOT EXECUTE ACTIONS.
     */
    async process(username, message, context, visualContext) {
        if (this.isProcessing) return { type: 'chat', content: "I'm thinking, give me a moment." };

        // Safety Timeout: Reset if stuck
        const processTimeout = setTimeout(() => {
            if (this.isProcessing) {
                console.warn("[Orchestrator] ⚠️ Thinking timeout (30s). Resetting state.");
                this.isProcessing = false;
            }
        }, 30000);

        this.isProcessing = true;

        try {
            // 1. Memory Retrieval (RAG)
            const relevantMemories = this.ltm ? await this.ltm.search(message, 3) : [];
            const memoryContext = relevantMemories.map(m => m.text).join("\n");
            console.log(`[Orchestrator] Retrieved memories: ${relevantMemories.length}`);

            // 2. Strategic Planning (CEO)
            const enhancedContext = { ...context, memory: memoryContext };
            const highLevelSteps = await this.strategic.think(enhancedContext, visualContext, message);

            if (!highLevelSteps || highLevelSteps.length === 0) {
                return { type: 'chat', content: "I'm not sure how to do that." };
            }

            console.log(`[Orchestrator] Plan:`, highLevelSteps);
            this.activePlan = highLevelSteps;

            // 3. Tactical Expansion (Manager) - Convert High Level to Executable Plans
            const actions = [];
            for (const step of highLevelSteps) {
                const action = await this.tactical.planExecution(step, enhancedContext);
                if (action) {
                    actions.push(action);
                }
            }

            // 4. Save to Memory
            if (this.ltm) {
                this.ltm.add(`Goal: ${message}. Plan: ${JSON.stringify(highLevelSteps)}`, { user: username });
            }

            // RETURN THE PLAN ONLY
            return { type: 'strategy', steps: actions };

        } catch (error) {
            console.error("[Orchestrator] ❌ Error processing:", error);
            return { type: 'chat', content: "My brain hurts..." };
        } finally {
            clearTimeout(processTimeout);
            this.isProcessing = false;
        }
    }

    async gatherPerception() {
        const entities = Object.values(this.bot.entities)
            .filter(e => e.type === 'mob' || e.type === 'player')
            .filter(e => e.position.distanceTo(this.bot.entity.position) < 16)
            .sort((a, b) => a.position.distanceTo(this.bot.entity.position) - b.position.distanceTo(this.bot.entity.position))
            .slice(0, 10)
            .map(e => `${e.username || e.name} (${Math.round(e.position.distanceTo(this.bot.entity.position))}m)`);

        const inventory = {};
        this.bot.inventory.items().forEach(item => {
            inventory[item.name] = (inventory[item.name] || 0) + item.count;
        });

        return {
            nearbyEntities: entities,
            self: {
                health: Math.round(this.bot.health),
                food: Math.round(this.bot.food),
                position: this.bot.entity.position.floored(),
                inventory: inventory
            },
            time: this.bot.time.timeOfDay
        };
    }
}

module.exports = AgentOrchestrator;
