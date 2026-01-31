const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const collectBlock = require('mineflayer-collectblock').plugin;
const toolPlugin = require('mineflayer-tool').plugin;
const armorManager = require('mineflayer-armor-manager');
const fs = require('fs').promises;
const path = require('path');

// Phase 1: Dual-Brain
const AILayer = require('./ai-layer');
const TaskManager = require('./task-manager');

// Phase 2: Survival
const Primitives = require('./primitives');
const Behaviors = require('./behaviors');
const SurvivalSystem = require('./survival-system');

// Phase 3: Logistics & Memory
const MemoryManager = require('./memory-manager');
const InventoryManager = require('./InventoryManager');
const ChestTracker = require('./ChestTracker');

// Phase 4: Humanization

const IdleBehavior = require('./IdleBehavior');


const WebServer = require('./web-server');

// Phase 5: Vision System
const VisualCortex = require('./visual-cortex');

class BotCore {
    constructor(config, dependencies = {}) {
        this.config = config;
        this.bot = null;
        this.isInitialized = false;

        // Injected Dependencies
        this.vectorDB = dependencies.vectorDB || null;
        this.aiManager = dependencies.aiManager || null;

        if (this.aiManager) {
            this.aiManager.botCore = this; // Link back
        }

        // Core Components
        this.memory = new MemoryManager(__dirname);
        this.primitives = new Primitives(this);
        this.behaviors = new Behaviors(this);

        // Specialized Managers
        this.survivalSystem = new SurvivalSystem(this);
        this.inventoryManager = new InventoryManager(this);
        this.chestTracker = new ChestTracker(this);

        this.idleBehavior = new IdleBehavior(this);

        this.taskManager = new TaskManager(this);
        this.taskManager = new TaskManager(this);
        this.aiLayer = new AILayer(this);

        // Phase 9: God Mode Survival
        const ConsumableManager = require('./core/survival/ConsumableManager');
        this.consumableManager = new ConsumableManager(this);

        const PhysicsManager = require('./core/physics/PhysicsManager');
        this.physicsManager = new PhysicsManager(this);

        const CrystalCombat = require('./core/combat/CrystalCombat');
        this.crystalCombat = new CrystalCombat(this);

        const ItemEvaluator = require('./core/brain/ItemEvaluator');
        this.itemEvaluator = new ItemEvaluator(this);

        const BlacksmithManager = require('./core/crafting/BlacksmithManager');
        this.blacksmithManager = new BlacksmithManager(this);

        const StrategyBrain = require('./core/brain/StrategyBrain');
        this.strategyBrain = new StrategyBrain(this);

        // Deprecated
        this.webServer = new WebServer(this, 3000);

        // Vision System
        this.visualCortex = new VisualCortex(this);

        // Concurrency Control
        const ActionLock = require('./core/ActionLock');
        this.actionLock = new ActionLock();

        this.mcData = null;
        this.locationsCache = {}; // Cache for locations
    }

    // Unified LTM Access (VectorDB is primary)
    get ltm() {
        // If VectorDB is available, prefer it? 
        // Or return a composite object?
        // AgentOrchestrator uses this.ltm.
        return this.vectorDB || { locations: this.locationsCache };
    }

    async start() {
        await this.cleanup(); // Clean up before starting new instance

        if (!this.memoryInitialized) {
            await this.memory.init();
            console.log("Memory System (SQLite) Initialized.");
            this.locationsCache = await this.memory.getAllLocations();
            this.memoryInitialized = true;
        }

        if (!this.webServerStarted) {
            this.webServer.start();
            this.webServerStarted = true;
        }

        this.bot = mineflayer.createBot({
            host: this.config.bot.host,
            port: this.config.bot.port,
            username: this.config.bot.username,
            version: this.config.bot.version,
            auth: this.config.bot.auth
        });

        // CRITICAL FIX: Load all plugins safely
        // Critical plugins - bot cannot function without these
        this.safeLoadPlugin(pathfinder, 'pathfinder', true);
        // Non-critical plugins - bot can still work without these
        this.safeLoadPlugin(collectBlock, 'collectBlock', false);
        this.safeLoadPlugin(toolPlugin, 'toolPlugin', false);
        // ArmorManager v2.0.1 fixed the playerCollect crash, now safe to load
        this.safeLoadPlugin(armorManager, 'armorManager', false);
        this.safeLoadPlugin(pvp, 'pvp', false);

        this.registerEvents();
    }

    safeLoadPlugin(plugin, name, critical = false) {
        try {
            this.bot.loadPlugin(plugin);
            console.log(`[Plugin] Loaded ${name}`);
        } catch (e) {
            console.error(`[Plugin] Failed to load ${name}:`, e);
            if (critical) {
                console.error(`[FATAL] Critical plugin "${name}" failed to load. Exiting.`);
                process.exit(1);
            }
        }
    }

    async cleanup() {
        // Cleanup AI Worker
        if (this.aiManager) {
            await this.aiManager.cleanup();
        }
        if (this.consumableManager) {
            this.consumableManager.stop();
        }
        if (this.physicsManager) {
            this.physicsManager.stop();
        }

        if (!this.bot) return;
        console.log("[BotCore] Cleaning up previous bot instance...");
        try {
            this.bot.removeAllListeners();
            if (this.bot._client) this.bot._client.removeAllListeners();
            this.bot.end();
            this.bot.removeAllListeners(); // Redundant safe clear
        } catch (e) {
            // Ignore errors during cleanup
        }
        this.bot = null;
    }

    registerEvents() {
        this.bot.on('spawn', async () => {
            console.log("Bot đã spawn!");
            this.mcData = require('minecraft-data')(this.bot.version);

            await this.bot.waitForChunksToLoad();
            this.isInitialized = true;

            // Start modules
            this.survivalSystem.start();
            this.chestTracker.start();

            // Start IdleBehavior with safety guards (now safe after fixes)
            this.idleBehavior.start();

            // Initialize Vision System
            await this.visualCortex.init();

            // Phase 9: Start Consumable Manager & Physics
            this.consumableManager.start();
            this.physicsManager.start();

            // Phase 2: Initialize Agent Orchestrator (Cognitive Architecture)
            if (this.aiLayer && this.aiLayer.init) {
                await this.aiLayer.init();
            }

            // SYSTEM UNIFICATION: Initialize Goal Manager
            const GoalManager = require('./core/architecture/GoalManager');
            this.goalManager = new GoalManager(this);

            // Register Sources
            this.goalManager.registerSource('survival', () => this.survivalSystem.getProposal());

            // Phase 5: Strategy Brain (High Priority)
            if (this.strategyBrain) {
                this.goalManager.registerSource('strategy', () => this.strategyBrain.getProposal());
            }

            if (this.aiLayer && this.aiLayer.brain) {
                // Note: we need the Orchestrator, not just Brain. 
                // Assuming aiLayer.orchestrator exists or we need to access it differently.
                // In `ai-layer.js`, if it exposes orchestrator:
                // this.goalManager.registerSource('agent', () => this.aiLayer.orchestrator.getProposal());
                // For now, let's look at `ai-layer.js` if it has orchestrator.
                // Assuming we can access it via a getter or property if we refactored ai-layer.
            }

            // Start Goal Loop
            // Start Goal Loop (Fast Tick for Combat)
            setInterval(() => this.goalManager.tick(), 50);
            console.log('[System] GoalManager Active.');

            // Initialize Prismarine Viewer
            if (this.config.plugins && this.config.plugins.viewer && this.config.plugins.viewer.enabled) {
                const viewerPort = this.config.plugins.viewer.port || 3007;
                try {
                    const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
                    mineflayerViewer(this.bot, { port: viewerPort });
                    console.log(`[Viewer] Prismarine Viewer running at http://localhost:${viewerPort}`);
                } catch (err) {
                    console.error("[Viewer] Failed to start Prismarine Viewer:", err);
                }
            }

            this.say("vao roi day, lag vcl");
        });

        this.bot.on('chat', (username, message) => this.onChat(username, message));
        this.bot.on('error', (err) => {
            console.log('Lỗi kết nối:', err);
        });

        this.bot.on('end', (reason) => {
            console.log(`Bot đã ngắt kết nối: ${reason}`);
            console.log("Đang thử kết nối lại sau 30s...");
            this.isInitialized = false;
            setTimeout(() => this.start(), 30000);
        });

        this.bot.on('kicked', (reason) => {
            console.log('--- KICKED DEBUG START ---');
            try {
                console.log('Raw Reason Type:', typeof reason);
                console.log('Raw Reason:', JSON.stringify(reason, null, 2));
            } catch (e) {
                console.log('Kick reason (safe):', reason);
            }
            console.log('--- KICKED DEBUG END ---');
        });

        // Phase 5 Stability: Death Handler
        this.bot.on('death', () => {
            console.log("[BotCore] ☠️ Bot died! Resetting mental state...");

            // 1. Reset Task Manager
            if (this.taskManager) {
                this.taskManager.queue = [];
                this.taskManager.activeTask = null;
                this.taskManager.isBusy = false;
            }

            // 2. Clear Survival Stack
            if (this.survivalSystem && this.survivalSystem.stateStack) {
                this.survivalSystem.stateStack.clear();
            }

            // 3. Stop Pathfinder
            if (this.bot.pathfinder) {
                this.bot.pathfinder.setGoal(null);
            }

            // 4. Reset ActionLock
            if (this.actionLock) {
                this.actionLock.releaseAll(); // Safety release
            }

            this.say("Ouch! Chet roi. Resetting brain...");
        });
    }

    /**
     * Non-blocking chat handler - allows parallel conversation during tasks
     */
    onChat(username, message) {
        if (username === this.bot.username) return;

        // Log to SQLite (non-blocking)
        this.memory.logChat(username, message).catch(() => { });

        if (this.config.owner && this.config.owner.name !== username) return;

        console.log(`[CHAT] ${username}: ${message}`);

        // Fire-and-forget AI processing - non-blocking
        this._processChat(username, message).catch(e => {
            console.error("[BotCore] AI processing failed:", e.message);
        });
    }

    /**
     * Async chat processing (called from onChat)
     */
    async _processChat(username, message) {
        // Stop fidget loop when receiving new command from owner
        this.stopFidgetLoop();

        try {
            const plan = await this.aiLayer.processMessage(username, message);

            if (plan && plan.steps) {
                const isUrgent = plan.type === 'reflex';
                this.taskManager.addTask(plan, username, isUrgent);
            }
        } catch (e) {
            console.error("[BotCore] AI error:", e);
            // FIX: Activate Silent Guardian Protocol instead of public "lag vcl"
            await this.activateGuardianMode(e.message || 'Unknown error');
        }
    }

    summarizeInventory(items) {
        const summary = {};
        for (const item of items) { summary[item.name] = (summary[item.name] || 0) + item.count; }
        return summary;
    }

    say(message) {
        if (this.bot) this.bot.chat(message);
    }

    /**
     * Send private whisper to a player (Silent Guardian Protocol)
     */
    whisper(username, message) {
        if (this.bot) this.bot.chat(`/tell ${username} ${message}`);
    }

    /**
     * Silent Guardian Protocol - Activate when AI fails
     * Step 1: Cancel actions, equip weapon/shield
     * Step 2: Eat if low health
     * Step 3: Whisper alert to owner
     * Step 4: Start fidget loop
     * Step 5: Wait for manual override
     */
    async activateGuardianMode(error) {
        console.log('[Guardian] ⚔️ Activating Silent Guardian Protocol...');

        try {
            // Step 1: Cancel current pathfinding and clear control states
            if (this.bot.pathfinder) {
                this.bot.pathfinder.setGoal(null);
            }
            this.bot.clearControlStates();

            // Step 1b: Equip shield or sword
            const items = this.bot.inventory.items();
            const shield = items.find(i => i.name.includes('shield'));
            const sword = items.find(i => i.name.includes('sword'));
            if (shield) {
                await this.bot.equip(shield, 'off-hand').catch(() => { });
            }
            if (sword) {
                await this.bot.equip(sword, 'hand').catch(() => { });
            }

            // Step 2: Eat if low health
            if (this.bot.health < 10 && this.bot.food < 18) {
                const food = items.find(i =>
                    i.name.includes('cooked') || i.name.includes('bread') ||
                    i.name.includes('apple') || i.name.includes('golden')
                );
                if (food) {
                    await this.bot.equip(food, 'hand').catch(() => { });
                    await this.bot.consume().catch(() => { });
                }
            }

            // Step 3: Whisper alert to owner
            const owner = this.config.owner?.name || process.env.BOT_OWNER || 'Steve';
            const shortError = String(error).substring(0, 50);
            this.whisper(owner, `[ALERT] AI failure: ${shortError}. Holding position.`);

            // Step 4: Start fidget loop to prevent AFK kick
            this.startFidgetLoop();

            console.log('[Guardian] ✅ Guardian mode active. Waiting for orders.');
        } catch (e) {
            console.error('[Guardian] Failed to fully activate:', e.message);
        }
    }

    /**
     * Deactivate Guardian Mode manually
     */
    deactivateGuardianMode() {
        this.stopFidgetLoop();
        if (this.bot) {
            this.bot.deactivateItem(); // Lower shield
        }
        console.log('[Guardian] ✅ Manual override. Resuming operations.');
        this.say("Guardian Mode deactivated. Back to work.");
    }

    /**
     * Fidget loop - look around and jump occasionally to avoid AFK kick
     */
    startFidgetLoop() {
        if (this.fidgetInterval) return; // Already running

        this.fidgetInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;

            // Random look direction
            const yaw = (Math.random() - 0.5) * Math.PI;
            const pitch = (Math.random() - 0.5) * 0.5;
            this.bot.look(this.bot.entity.yaw + yaw, pitch, false);

            // Occasionally jump
            if (Math.random() < 0.2 && this.bot.entity.onGround) {
                this.bot.setControlState('jump', true);
                setTimeout(() => this.bot?.setControlState('jump', false), 100);
            }
        }, 5000); // Every 5 seconds

        console.log('[Guardian] Fidget loop started');
    }

    /**
     * Stop fidget loop when resuming normal operations
     */
    stopFidgetLoop() {
        if (this.fidgetInterval) {
            clearInterval(this.fidgetInterval);
            this.fidgetInterval = null;
            console.log('[Guardian] Fidget loop stopped');
        }
    }

    /**
     * Build context for AI - delegates to ContextManager
     * Used by web-server.js god-whisper and task-manager.js
     */
    buildContext(username) {
        if (this.aiLayer && this.aiLayer.contextManager) {
            return this.aiLayer.contextManager.getFullContext(username);
        }
        return { error: 'Context manager not available' };
    }
}

module.exports = BotCore;