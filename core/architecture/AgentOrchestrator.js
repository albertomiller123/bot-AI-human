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
        // 1. Memory Retrieval (RAG)
        const relevantMemories = this.ltm ? await this.ltm.search(message, 3) : [];
        const memoryContext = relevantMemories.map(m => m.text).join("\n");
        console.log(`[Orchestrator] Retrieved memories: ${relevantMemories.length}`);

        // 2. Strategic Planning (CEO)
        // Inject memory into context
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
    }
}

module.exports = AgentOrchestrator;
