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
        if (!this.botCore.memoryManager) throw new Error("MemoryManager not ready");

        this.ltm = new VectorDB(this.botCore.memoryManager, this.ai);
        await this.ltm.init();
        console.log("[AgentOrchestrator] Cognitive Architecture Ready");
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

            // 3. Tactical Execution (Manager)
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
