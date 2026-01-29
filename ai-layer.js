/**
 * ai-layer.js - Visual-Agentic Dual-Brain AI Layer
 * 
 * Commander (openai-gpt-oss-20b): Vision + Planning
 * Trooper (mistral-nemotron): Reflex + Fast Execution
 */

const AIManager = require('./core/AIManager');
const AIRouter = require('./ai-router');
const AIReflex = require('./ai-reflex');
const ContextManager = require('./ContextManager');

// FIX: Import helper functions to prevent ReferenceError
const { getToolsForLLM, validateActionCall } = require('./action-registry');

class AILayer {
    constructor(botCore) {
        this.botCore = botCore;
        this.contextManager = new ContextManager(botCore);

        // Phase 12: Dual-Brain Infrastructure
        this.brain = new AIManager(botCore);

        // CRITICAL FIX: Initialize Router and Reflex sub-agents
        const apiKey = process.env.MEGALLM_API_KEY;
        const baseURL = 'https://ai.megallm.io/v1';

        if (apiKey) {
            this.router = new AIRouter(apiKey, baseURL);
            this.reflex = new AIReflex(apiKey, baseURL);
        } else {
            console.warn('[AILayer] MEGALLM_API_KEY not set! Router/Reflex disabled.');
            this.router = null;
            this.reflex = null;
        }

        // Default timeout for API calls (ms)
        this.apiTimeout = 30000;
    }

    /**
     * Wrap async operations with timeout to prevent hanging
     */
    async _withTimeout(promise, timeoutMs = this.apiTimeout, label = 'API call') {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Main entry point for processing user messages
     */
    async processMessage(username, message) {
        // Safety check: if AI disabled, just echo back
        if (!this.router || !this.reflex) {
            console.warn('[AILayer] AI disabled, no API key.');
            this.botCore.say('AI chua hoat dong, thieu API key');
            return null;
        }

        const contextLite = this.contextManager.getLiteContext(username);
        const intent = await this.router.classifyIntent(message, contextLite);

        console.log(`[AI Layer] Intent: ${intent}`);

        switch (intent) {
            case 'REFLEX':
                return this._handleReflex(contextLite, message, username);

            case 'STRATEGY':
                return this._handleStrategy(username, message);

            case 'CHATTING':
            default:
                const reply = await this.reflex.handleChat(contextLite, message);
                this.botCore.say(reply);
                return null;
        }
    }

    /**
     * Handle quick reflex actions (Trooper model)
     */
    async _handleReflex(contextLite, message, username) {
        // Pass username so bot knows who to follow
        const quickAction = await this.reflex.handleQuickCommand(contextLite, message, username);
        if (quickAction) {
            // Inject command_by if needed
            if (!quickAction.params) quickAction.params = {};
            if (!quickAction.params.name && username) quickAction.params.name = username;

            return { complex_task: message, steps: [quickAction] };
        }
        return null;
    }

    /**
     * Handle complex strategy with Vision (Commander model)
     */
    async _handleStrategy(username, message) {
        console.log('[AI Layer] VisualPlanner activated');

        // Get full context + visual
        const contextFull = await this.contextManager.getFullContext(username);
        const visualContext = this.botCore.visualCortex?.getVisualContext() || { description: 'Vision unavailable' };

        // Step 1: VisualPlanner generates high-level plan
        const highLevelPlan = await this._visualPlannerThink(message, contextFull, visualContext);
        if (!highLevelPlan || highLevelPlan.length === 0) {
            return null;
        }

        console.log(`[AI Layer] High-level plan: ${highLevelPlan.length} steps`);

        // Step 2: FastExecutor converts each step to JSON Action
        const actionSteps = [];
        for (const step of highLevelPlan) {
            const action = await this._fastExecutorConvert(step);
            if (action) {
                actionSteps.push(action);
            }
        }

        return {
            complex_task: message,
            steps: actionSteps
        };
    }

    /**
     * VisualPlanner Agent (Commander - openai-gpt-oss-20b)
     * Analyzes context and generates high-level sub-steps
     */
    async _visualPlannerThink(goal, context, visualContext) {
        const prompt = `You are a Minecraft Architect AI. Analyze the situation and create a plan.

CURRENT SITUATION:
- Position: ${JSON.stringify(context.position)}
- Health: ${context.health}/20, Food: ${context.food}/20
- Inventory: ${context.inventory}
- Visual: ${visualContext.description}
- Looking at: ${JSON.stringify(visualContext.lookingAt)}

USER GOAL: "${goal}"

Break this down into 3-7 concrete sub-steps. Each step should be a simple action.
Output ONLY a JSON array of strings, no explanation.

Example output:
["Go to the forest", "Mine 10 oak logs", "Craft planks", "Build a small shelter"]`;

        // PHASE 12: Use System 2 (Slow Brain)
        const content = await this.brain.slow(prompt, false);
        return this._parseJSONArray(content || "");
    }

    /**
     * FastExecutor Agent (Trooper - mistral-nemotron)
     * Converts natural language step to JSON Action
     */
    async _fastExecutorConvert(step, retries = 2) {
        const tools = getToolsForLLM();
        const toolNames = tools.map(t => t.function.name).join(', ');

        const prompt = `You are a Minecraft bot executor. Convert the instruction to a JSON action call.

INSTRUCTION: "${step}"

AVAILABLE ACTIONS (YOU MUST ONLY USE THESE):
${toolNames}

CRITICAL RULES:
- ONLY use actions from the list above. DO NOT invent new actions.
- If you cannot perform the instruction with any available action, use: say_message
- Common actions: follow_player, pathfind_to, mine_block, craft_item, say_message, stop_actions, wander_random, attack_target, eat_food

Output ONLY valid JSON: {"action": "action_name", "params": {...}}

Examples:
- "follow me" -> {"action": "follow_player", "params": {"name": "player_name"}}
- "go chop wood" -> {"action": "mine_block", "params": {"type_name": "oak_log", "count": 10}}
- "set gamemode" -> {"action": "say_message", "params": {"message": "I cannot change game mode, only server admin can."}}`;

        for (let attempt = 0; attempt <= retries; attempt++) {
            // PHASE 12: Use System 1 (Fast Brain)
            const content = await this.brain.fast(prompt, true);
            const action = this._parseJSON(content || "");

            if (action && action.action) {
                // Validate against schema
                const validation = validateActionCall(action.action, action.params || {});
                if (validation.valid) {
                    return action;
                } else if (attempt < retries) {
                    console.log(`[FastExecutor] Validation failed, retry ${attempt + 1}: ${validation.error}`);
                    continue;
                } else {
                    // After all retries, fallback to say_message
                    console.log(`[FastExecutor] All retries failed, falling back to say_message`);
                    return { action: "say_message", params: { message: "Xin loi, toi khong the lam viec nay." } };
                }
            }
        }

        return { action: "say_message", params: { message: "Khong hieu yeu cau cua ban." } };
    }

    /**
     * Create correction plan when action fails (Commander model)
     */
    async createCorrectionPlan(originalTask, failedStep, errorMessage, context) {
        const visualContext = this.botCore.visualCortex?.getVisualContext() || { description: 'Vision unavailable' };

        const prompt = `A Minecraft action failed. Create a correction plan.

ORIGINAL TASK: "${originalTask.complex_task}"
FAILED STEP: ${JSON.stringify(failedStep)}
ERROR: "${errorMessage}"
VISUAL: ${visualContext.description}
FORBIDDEN ACTIONS: ${JSON.stringify(context.forbidden_actions || [])}

Suggest 1-3 alternative steps to fix or work around this issue.
Output ONLY a JSON array: ["step1", "step2"]`;

        try {
            // PHASE 12 FIX: Use System 2 (Slow Brain) instead of direct client access
            // this.brain.slow returns the content string directly
            const content = await this.brain.slow(prompt, false);
            const steps = this._parseJSONArray(content || "");

            if (!steps || steps.length === 0) return null;

            // Convert to action steps
            const actionSteps = [];
            for (const step of steps) {
                const action = await this._fastExecutorConvert(step);
                if (action) actionSteps.push(action);
            }

            return {
                complex_task: `Fix: ${errorMessage}`,
                steps: actionSteps
            };
        } catch (error) {
            console.error('[CorrectionPlan] Error:', error.message);
            return null;
        }
    }

    /**
     * Parse JSON from LLM response (handles markdown code blocks)
     */
    _parseJSON(content) {
        try {
            // Try direct parse
            return JSON.parse(content.trim());
        } catch {
            // Try extracting from markdown
            const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                try {
                    return JSON.parse(match[1].trim());
                } catch {
                    return null;
                }
            }
            // Try finding JSON object
            const objMatch = content.match(/\{[\s\S]*\}/);
            if (objMatch) {
                try {
                    return JSON.parse(objMatch[0]);
                } catch {
                    return null;
                }
            }
            return null;
        }
    }

    /**
     * Parse JSON array from LLM response
     */
    _parseJSONArray(content) {
        try {
            const parsed = JSON.parse(content.trim());
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[1].trim());
                    return Array.isArray(parsed) ? parsed : null;
                } catch {
                    return null;
                }
            }
            const arrMatch = content.match(/\[[\s\S]*\]/);
            if (arrMatch) {
                try {
                    return JSON.parse(arrMatch[0]);
                } catch {
                    return null;
                }
            }
            return null;
        }
    }

    // Legacy compatibility
    async createPlan(context, command) {
        return await this.processMessage(context.command_by, command);
    }
}

module.exports = AILayer;
