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
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.isInitialized = false;

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
        this.aiLayer = new AILayer(this);

        // Deprecated
        this.webServer = new WebServer(this, 3000);

        // Vision System
        this.visualCortex = new VisualCortex(this);

        this.mcData = null;
        this.locationsCache = {}; // Cache for locations
    }

    // SQLite-based LTM/STM proxy 
    get ltm() { return { locations: this.locationsCache }; }

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
        if (!this.bot) return;
        console.log("[BotCore] Cleaning up previous bot instance...");
        try {
            this.bot.removeAllListeners();
            if (this.bot._client) this.bot._client.removeAllListeners();
            this.bot.end();
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
        try {
            const plan = await this.aiLayer.processMessage(username, message);

            if (plan && plan.steps) {
                this.taskManager.addTask(plan, username);
            }
        } catch (e) {
            console.error("[BotCore] AI error:", e);
            this.say("lag vcl dmm");
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