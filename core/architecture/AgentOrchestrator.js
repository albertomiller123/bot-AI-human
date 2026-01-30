const StrategicAgent = require('./StrategicAgent');
const TacticalAgent = require('./TacticalAgent');
const VectorDB = require('../memory/VectorDB');

class AgentOrchestrator {
    constructor(botCore) {
        this.botCore = botCore;
        this.ai = botCore.aiLayer.brain; // AIManager from existing AILayer (temporarily accessed)

        this.strategic = new StrategicAgent(this.ai);
        this.tactical = new TacticalAgent(this.ai);

        // Memory System
        // Will initialize VectorDB with existing instances
        // But for now, we assume this is called AFTER botCore init
        // We'll lazy init memory
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

        console.log("[AgentOrchestrator] Cognitive Architecture Ready (Shared Memory)");
    }

    /**
     * Called by GoalManager to bid for control
     */
    async getProposal() {
        // If we simply have a plan in memory (queued by chat), we bid to execute it.
        // For now, let's assume if `this.activePlan` exists, we bid high (90).

        if (this.activePlan) {
            return {
                id: 'execute_agent_plan',
                priority: 90, // User Command Priority
                execute: async () => {
                    console.log("[Orchestrator] Executing Active Plan...");
                    // Logic to execute the plan step-by-step
                    // For MVP, we just resume processing if halted?
                    // Or we let the Orchestrator manage its own loop, but only when GoalManager says "Go".
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
     */
    async process(username, message, context, visualContext) {
        if (this.isProcessing) return;

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
            this.activePlan = highLevelSteps; // Store plan for GoalManager to pick up

            // 3. Tactical Execution (Manager)
            // DEPRECATED: We don't execute immediately anymore. We wait for GoalManager.
            // BUT for MVP compatibility, let's keep executing tactical steps here IF we are allowed?
            // BETTER: The execute logic should be moved to the `execute` callback of the proposal.

            // For now, let's just return the strategy and let the tactical loop pick it up via GoalManager
            // (Refactor Phase 2 will fully move execution to GoalManager callback)

            const actions = [];
            for (const step of highLevelSteps) {
                const action = await this.tactical.planExecution(step, enhancedContext);
                if (action) {
                    actions.push(action);
                } else {
                    console.warn(`[Orchestrator] Failed to execute step: ${step}`);
                }
            }

            // 4. Save to Memory
            if (this.ltm) {
                this.ltm.add(`Goal: ${message}. Plan: ${JSON.stringify(highLevelSteps)}`, { user: username });
            }

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
        // Optimize Context: Limit Entities and Compress Inventory

        const entities = Object.values(this.bot.entities)
            .filter(e => e.type === 'mob' || e.type === 'player')
            .filter(e => e.position.distanceTo(this.bot.entity.position) < 16)
            .sort((a, b) => a.position.distanceTo(this.bot.entity.position) - b.position.distanceTo(this.bot.entity.position))
            .slice(0, 10) // Limit to top 10 nearest
            .map(e => `${e.username || e.name} (${Math.round(e.position.distanceTo(this.bot.entity.position))}m)`);

        // Compress Inventory
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
                inventory: inventory // Compressed format
            },
            time: this.bot.time.timeOfDay
        };
    }
}

module.exports = AgentOrchestrator;
