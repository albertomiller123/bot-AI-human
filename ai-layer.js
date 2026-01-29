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
        // Initialize Router and Reflex sub-agents using the Brain (worker proxy)
        this.router = new AIRouter(this.brain);
        this.reflex = new AIReflex(this.brain);

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
        // Reflex Priority: 2
        if (!this.botCore.actionLock.tryAcquire('reflex', 2, 5000)) {
            return null; // Busy with higher priority task
        }

        // Pass username so bot knows who to follow
        const quickAction = await this.reflex.handleQuickCommand(contextLite, message, username);
        if (quickAction) {
            // Inject command_by if needed
            if (!quickAction.params) quickAction.params = {};
            if (!quickAction.params.name && username) quickAction.params.name = username;

            return {
                type: 'reflex',
                complex_task: message,
                steps: [quickAction]
            };
        }

        this.botCore.actionLock.release('reflex'); // Release if no action
        return null;
    }

    /**
     * Handle complex strategy with Vision (Commander model)
     */
    async _handleStrategy(username, message) {
        // Strategy Priority: 1
        // Cannot interrupt Reflex or Guardian
        if (!this.botCore.actionLock.tryAcquire('strategy', 1, 60000)) {
            this.botCore.say("Dang ban viec gap, doi ti.");
            return null;
        }

        console.log('[AI Layer] VisualPlanner activated');

        // ... rest of logic ...

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
            type: 'strategy',
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
Output ONLY a JSON array of strings: ["step 1", "step 2"].`;

        // PHASE 12: Use System 2 (Slow Brain) with JSON Mode
        const content = await this.brain.slow(prompt, true);
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
                    // After all retries, fallback to guardian mode (Silent Guardian Protocol)
                    console.log(`[FastExecutor] All retries failed, activating guardian mode`);
                    return {
                        action: "guardian_mode",
                        params: {
                            error: validation.error,
                            original_step: step
                        }
                    };
                }
            }
        }

        // Cannot parse AI response at all
        return {
            action: "guardian_mode",
            params: {
                error: "Cannot understand AI response",
                original_step: step
            }
        };
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
            // PHASE 12 FIX: Use System 2 (Slow Brain) with JSON Mode
            const content = await this.brain.slow(prompt, true);
            const steps = this._parseJSONArray(content || "");

            if (!steps || steps.length === 0) return null;

            // Convert to action steps
            const actionSteps = [];
            for (const step of steps) {
                const action = await this._fastExecutorConvert(step);
                if (action) actionSteps.push(action);
            }

            return {
                complex_task: `Correction for: ${errorMessage}`,
                steps: actionSteps
            };
        } catch (error) {
            console.error('[CorrectionPlan] Error:', error.message);
            return null;
        }
    }

    /**
     * Repair common JSON issues from LLM output
     */
    _repairJSON(content) {
        if (!content || typeof content !== 'string') return content;

        let repaired = content.trim();

        // 1. Remove markdown code block wrappers
        const codeBlockMatch = repaired.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            repaired = codeBlockMatch[1].trim();
        }

        // 2. Remove BOM and control characters (except newlines/tabs)
        repaired = repaired.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // 3. Fix trailing commas before } or ]
        repaired = repaired.replace(/,\s*([}\]])/g, '$1');

        // 4. Fix single quotes to double quotes (careful with apostrophes)
        // Only replace quotes that look like JSON string delimiters
        repaired = repaired.replace(/'([^']*)'(\s*[,:\]}])/g, '"$1"$2');
        repaired = repaired.replace(/(\s*[\[{,:])\s*'([^']*)'/g, '$1"$2"');

        // 5. Fix missing closing brackets (simple heuristic)
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/]/g) || []).length;

        if (openBraces > closeBraces) {
            repaired += '}'.repeat(openBraces - closeBraces);
        }
        if (openBrackets > closeBrackets) {
            repaired += ']'.repeat(openBrackets - closeBrackets);
        }

        // 6. Remove text before first { or [ (LLM often adds explanations)
        const firstBrace = repaired.indexOf('{');
        const firstBracket = repaired.indexOf('[');
        let startIndex = -1;

        if (firstBrace !== -1 && firstBracket !== -1) {
            startIndex = Math.min(firstBrace, firstBracket);
        } else if (firstBrace !== -1) {
            startIndex = firstBrace;
        } else if (firstBracket !== -1) {
            startIndex = firstBracket;
        }

        if (startIndex > 0) {
            repaired = repaired.substring(startIndex);
        }

        return repaired;
    }

    /**
     * Parse JSON from LLM response (handles markdown code blocks)
     * Now with repair logic for robustness
     */
    _parseJSON(content) {
        if (!content) return null;

        // Strategy 1: Direct parse
        try {
            return JSON.parse(content.trim());
        } catch { /* continue */ }

        // Strategy 2: Parse repaired content
        const repaired = this._repairJSON(content);
        try {
            return JSON.parse(repaired);
        } catch { /* continue */ }

        // Strategy 3: Extract JSON object with regex
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
            try {
                const repairedObj = this._repairJSON(objMatch[0]);
                return JSON.parse(repairedObj);
            } catch { /* continue */ }
        }

        console.warn('[AILayer] JSON parse failed after all strategies');
        return null;
    }

    /**
     * Parse JSON array from LLM response
     * Now with repair logic for robustness
     */
    _parseJSONArray(content) {
        if (!content) return null;

        // Strategy 1: Direct parse
        try {
            const parsed = JSON.parse(content.trim());
            return Array.isArray(parsed) ? parsed : null;
        } catch { /* continue */ }

        // Strategy 2: Parse repaired content
        const repaired = this._repairJSON(content);
        try {
            const parsed = JSON.parse(repaired);
            return Array.isArray(parsed) ? parsed : null;
        } catch { /* continue */ }

        // Strategy 3: Extract JSON array with regex
        const arrMatch = content.match(/\[[\s\S]*\]/);
        if (arrMatch) {
            try {
                const repairedArr = this._repairJSON(arrMatch[0]);
                const parsed = JSON.parse(repairedArr);
                return Array.isArray(parsed) ? parsed : null;
            } catch { /* continue */ }
        }

        console.warn('[AILayer] JSON array parse failed after all strategies');
        return null;
    }

    // Legacy compatibility
    async createPlan(context, command) {
        return await this.processMessage(context.command_by, command);
    }
}

module.exports = AILayer;
