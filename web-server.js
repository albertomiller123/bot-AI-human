const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

class WebServer {
    constructor(botCore, port = 3000) {
        this.botCore = botCore;
        this.port = port;
        this.app = express();
        // this.apiSecret = process.env.API_SECRET; // DEPRECATED

        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.app.use(express.static(path.join(__dirname, 'public')));

        // === SECURITY: API Authentication Middleware ===
        // === SECURITY: API Authentication Middleware ===
        const AUTH_TOKEN = process.env.WEB_ADMIN_TOKEN;
        if (!AUTH_TOKEN) {
            console.error("❌ CRITICAL: WEB_ADMIN_TOKEN not set in .env! Web Server disabled for security.");
            return; // Disable middleware/routes setup (effectively disables web access)
        }

        this.app.use('/api', (req, res, next) => {
            // Skip auth for GET requests (status check) if no secret configured
            // Phase 5 Security: Strict Token Check
            if (req.path === '/status') return next(); // Public status is OK

            const token = req.query.token || req.headers['authorization'];
            // Accept "Bearer token" or raw token
            const valid = token === AUTH_TOKEN || (token && token.startsWith('Bearer ') && token.split(' ')[1] === AUTH_TOKEN);

            if (!valid) {
                console.warn(`[Security] 403 Forbidden: ${req.path} from ${req.ip}`);
                return res.status(403).json({ error: "Forbidden: Invalid Token. Use ?token=..." });
            }
            next();
        });

        // Explicit route for dashboard if needed, or index.html match
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public/dashboard.html'));
        });

        this.setupRoutes();
    }

    setupRoutes() {
        this.app.get('/api/status', (req, res) => {
            const bot = this.botCore.bot;
            if (!bot) return res.json({ status: 'offline' });



            this.botCore.memory.getRecentChats(10).then(chats => {
                res.json({
                    status: 'online',
                    username: bot.username,
                    health: bot.health,
                    food: bot.food,
                    position: bot.entity ? bot.entity.position : null,
                    task: this.botCore.taskManager.activeTask ? this.botCore.taskManager.activeTask.complex_task : "Idle",
                    chatLog: chats
                });
            });
        });

        this.app.post('/api/chat', (req, res) => {
            const { message } = req.body;
            if (message) {
                this.botCore.say(message);
                // Log manual chat
                this.botCore.memory.logChat("WebUser", message);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: "Message empty" });
            }
        });

        // API for Command Deck (Butler integration)
        this.app.post('/api/command', async (req, res) => {
            const { command } = req.body;
            if (!command) return res.status(400).json({ error: "Command empty" });

            try {
                let result = "OK";
                const bot = this.botCore.bot;
                const butler = this.botCore.survivalSystem?.butler;
                const primitives = this.botCore.primitives;
                const behaviors = this.botCore.behaviors;

                // Safety: Check if bot is connected and spawned for commands that need it
                const requiresBot = ['move_forward', 'move_back', 'move_left', 'move_right', 'jump', 'attack_nearest'];
                if (requiresBot.includes(command) && (!bot || !bot.entity)) {
                    return res.status(503).json({ error: "Bot not ready (connecting or dead)" });
                }

                // Prevent conflict with AI Task Manager
                if (this.botCore.actionLock && !this.botCore.actionLock.tryAcquire('web-user', 3000)) {
                    return res.status(409).json({ error: "Bot is busy (Locked by AI/Game Task)" });
                }

                switch (command) {
                    // Butler commands
                    case 'come':
                        result = butler ? await butler.comeToOwner(this.botCore.config.owner?.name || "Player") : "Butler not available";
                        break;
                    case 'sethome':
                        result = butler ? butler.setHome() : "Butler not available";
                        break;
                    case 'stop':
                        if (butler) await butler.stop();
                        if (behaviors?.guard) behaviors.guard.stop();
                        this.botCore.taskManager?.stopCurrentTask();
                        result = "All actions stopped";
                        break;

                    // Guard toggle
                    case 'guard_toggle':
                        if (behaviors?.guard) {
                            if (behaviors.guard.isActive) {
                                behaviors.guard.stop();
                                result = "Guard mode OFF";
                            } else {
                                behaviors.guard.start(20);
                                result = "Guard mode ON (radius: 20)";
                            }
                        } else {
                            result = "Guard behavior not available";
                        }
                        break;

                    // Movement commands
                    case 'move_forward':
                        bot.setControlState('forward', true);
                        setTimeout(() => bot.setControlState('forward', false), 500);
                        result = "Moving forward";
                        break;
                    case 'move_back':
                        bot.setControlState('back', true);
                        setTimeout(() => bot.setControlState('back', false), 500);
                        result = "Moving back";
                        break;
                    case 'move_left':
                        bot.setControlState('left', true);
                        setTimeout(() => bot.setControlState('left', false), 500);
                        result = "Moving left";
                        break;
                    case 'move_right':
                        bot.setControlState('right', true);
                        setTimeout(() => bot.setControlState('right', false), 500);
                        result = "Moving right";
                        break;
                    case 'jump':
                        bot.setControlState('jump', true);
                        setTimeout(() => bot.setControlState('jump', false), 300);
                        result = "Jumping";
                        break;

                    // Tactical commands
                    case 'eat':
                        if (behaviors) {
                            result = await behaviors.eat_food();
                        } else {
                            result = "Behaviors not available";
                        }
                        break;
                    case 'attack_nearest':
                        const nearest = bot.nearestEntity(e => e.type === 'hostile' || (e.type === 'player' && e.username !== bot.username));
                        if (nearest) {
                            bot.pvp.attack(nearest);
                            result = `Attacking ${nearest.name || nearest.username}`;
                        } else {
                            result = "No target found";
                        }
                        break;
                    case 'look_random':
                        if (primitives) {
                            await primitives.look_random();
                            result = "Looking around";
                        } else {
                            result = "Primitives not available";
                        }
                        break;
                    case 'wander':
                        if (behaviors) {
                            await behaviors.wander_random(10);
                            result = "Wandering";
                        } else {
                            result = "Behaviors not available";
                        }
                        break;

                    default:
                        return res.status(400).json({ error: `Unknown command: ${command}` });
                }

                return res.json({ success: true, result });
            } catch (error) {
                console.error("[Web API] Command error:", error);
                res.status(500).json({ error: error.message });
            }
        });

        // API for God Whisper (Context Injection)
        this.app.post('/api/god-whisper', async (req, res) => {
            const { message } = req.body;
            if (!message) return res.status(400).json({ error: "Message empty" });

            try {
                console.log(`[God Whisper] Injecting: "${message}"`);

                // 1. Inject into ContextMemory (as a system note)
                // 1. Inject into ContextMemory (as a system note)
                if (this.botCore.memory && this.botCore.memory.addSystemNote) {
                    this.botCore.memory.addSystemNote(message);
                }

                // 2. Trigger AI Planning immediately with this context
                const context = this.botCore.buildContext("God");
                // We treat "God" as a super-user. 

                // Direct call to AI Layer strategy
                const plan = await this.botCore.aiLayer.createPlan({ ...context, god_mode: true }, message);

                if (plan && plan.steps) {
                    this.botCore.taskManager.addTask(plan, "God");
                }

                res.json({ success: true, plan });
            } catch (error) {
                console.error("[God Whisper] Failed:", error);
                res.status(500).json({ error: error.message });
            }
        });

        // API for Config Updates
        this.app.post('/api/config', (req, res) => {
            const { reflex } = req.body;
            if (reflex) {
                // Update Runtime Config
                this.botCore.config.reflex = { ...this.botCore.config.reflex, ...reflex };
                console.log("[Web] Config updated:", this.botCore.config.reflex);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: "No config data provided" });
            }
        });
    }

    async start() {
        if (!process.env.WEB_ADMIN_TOKEN) {
            console.warn("[Web] Server disabled due to missing token.");
            return;
        }

        const tryStart = (port, attemptsLeft) => {
            const server = this.app.listen(port, () => {
                this.port = port;
                console.log(`[Web] Interface running at http://localhost:${port}`);
            });

            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
                    console.warn(`[Web] Port ${port} is busy, trying ${port + 1}...`);
                    tryStart(port + 1, attemptsLeft - 1);
                } else if (err.code === 'EADDRINUSE') {
                    console.error(`[Web] CRITICAL: All ports from ${this.port} to ${port} are busy. Web Server NOT started.`);
                } else {
                    console.error("[Web] ❌ Server error:", err);
                }
            });
        };

        tryStart(this.port, 5);
    }
}

module.exports = WebServer;
