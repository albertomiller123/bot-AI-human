const GatherBehavior = require('./behaviors/survival/GatherBehavior');
const CraftingManager = require('./behaviors/survival/CraftingManager');
const ShelterBuilder = require('./behaviors/survival/ShelterBuilder');

const StripMiner = require('./behaviors/mining/StripMiner');
const UpgradeManager = require('./behaviors/progression/UpgradeManager');
const LavaAvoidance = require('./behaviors/navigation/LavaAvoidance');

const MobTactics = require('./behaviors/combat/MobTactics');
const BastionLooter = require('./behaviors/nether/BastionLooter');
const StrongholdNavigator = require('./behaviors/stronghold/StrongholdNavigator');

const ChatEngine = require('./behaviors/social/ChatEngine');
const ThreatManager = require('./behaviors/social/ThreatManager');
const StealthTactics = require('./behaviors/social/StealthTactics');

const InputHumanizer = require('./humanizer/InputHumanizer');
const FidgetRoutine = require('./behaviors/idle/FidgetRoutine');
const InventorySorter = require('./inventory/InventorySorter');

const GoalArbitrator = require('./behaviors/strategy/GoalArbitrator');
const AdvancedPVP = require('./behaviors/combat/AdvancedPVP');
const ContextMemory = require('./behaviors/social/ContextMemory');

class SurvivalSystem {
    constructor(botCore) {
        console.log("SurvivalSystem constructor start");
        this.botCore = botCore;
        this.bot = null; // Lazy init
        this.lastHealth = 20;

        // Phase 9: Load Config
        try {
            this.config = require('./config/settings.json');
        } catch (e) {
            console.log("Config not found, using defaults");
            this.config = {
                survival: { autoTotemHealth: 8, criticalHealth: 6 },
                combat: { strafeDistance: 6, jumpBeforeAttack: true, engageDistance: 10 }
            };
        }

        this.isStrafing = false;
        this.isProcessingTick = false;

        // placeholderhaviors
        this.gatherer = new GatherBehavior(botCore);
        this.crafter = new CraftingManager(botCore);
        this.builder = new ShelterBuilder(botCore);

        // Phase 2 Behaviors
        this.miner = new StripMiner(botCore);
        this.upgrader = new UpgradeManager(botCore);
        this.safety = new LavaAvoidance(botCore);

        // Phase 3 Behaviors
        this.combat = new MobTactics(botCore);
        this.nether = new BastionLooter(botCore);
        this.stronghold = new StrongholdNavigator(botCore);

        // Phase 4 Behaviors
        this.chatEngine = new ChatEngine(botCore);
        this.threat = new ThreatManager(botCore);
        this.stealth = new StealthTactics(botCore);

        // Phase 5 Behaviors
        this.humanizer = new InputHumanizer(botCore);
        this.fidger = new FidgetRoutine(botCore);
        this.sorter = new InventorySorter(botCore);

        // Phase 6 Behaviors
        this.brain = new GoalArbitrator(botCore);
        this.autoMode = true;

        // Phase 7 Behaviors
        this.pvp = new AdvancedPVP(botCore);

        // Phase 8 Behaviors
        this.memory = new ContextMemory(botCore);

        // Phase 14: Cognitive Loop (Memory System)
        const CognitiveSystem = require('./core/CognitiveSystem');
        this.cognitive = new CognitiveSystem(botCore);
        this.cognitive.start();

        // Phase 13: The Butler
        const ButlerBehavior = require('./behaviors/butler/ButlerBehavior');
        this.butler = new ButlerBehavior(botCore);

        // Phase 16: Survival Instincts & Stability (Anti-Freeze)
        const StateStack = require('./core/StateStack');
        const Watchdog = require('./core/Watchdog');
        const ReflexManager = require('./behaviors/instincts/ReflexManager');

        this.stateStack = new StateStack(botCore);
        this.watchdog = new Watchdog(botCore, this);
        this.reflex = new ReflexManager(botCore);

        // Phase 17: Autonomous Systems
        // Phase 17: Autonomous Systems
        const HealthMonitor = require('./core/HealthMonitor');
        const StuckDetector = require('./core/StuckDetector');
        const TrashFilter = require('./inventory/TrashFilter');

        // Phase 4: Advanced Skills
        const PartyManager = require('./behaviors/social/PartyManager');
        const VillagerTrader = require('./behaviors/economy/VillagerTrader');

        this.healthMonitor = new HealthMonitor(botCore);
        this.stuckDetector = new StuckDetector(botCore);
        this.trash = new TrashFilter(botCore);

        this.party = new PartyManager(botCore);
        this.trader = new VillagerTrader(botCore);
    }

    start() {
        this.bot = this.botCore.bot; // Init here
        this.watchdog.start();

        // Start autonomous systems
        this.healthMonitor.start();
        this.stuckDetector.start();
        if (this.fidger && this.fidger.start) this.fidger.start(); // Start Fidget

        // Trash Filter Interval (Every 60s)
        setInterval(() => this.trash.cleanInventory(), 60000);

        // Phase 7: PVP
        if (this.pvp) this.pvp.start();

        console.log("[SurvivalSystem] Autonomous systems started (HealthMonitor, StuckDetector, PVP)");

        // Hook up Chat Engine
        this.bot.on('chat', (username, message) => {
            this.chatEngine.handleChat(username, message);
        });

        // Memory Hooks
        this.bot.on('playerCollect', (collector, item) => {
            if (collector === this.bot.entity) {
                const nearbyPlayers = Object.values(this.bot.players).filter(p => p.entity && p.username !== this.bot.username && p.entity.position.distanceTo(this.bot.entity.position) < 5);
                if (nearbyPlayers.length === 1) {
                    this.memory.markFriend(nearbyPlayers[0].username);
                }
            }
        });

        // Entity Hurt - Commented out to prevent combat kicks
        /*
        this.bot.on('entityHurt', (entity) => {
            // ...
        });
        */

        // Physics Tick - DISABLED for Stability on 1.21.1
        /*
        this.bot.on('physicsTick', async () => {
             // ...
        });
        */
        console.log("SurvivalSystem: Safe Mode (PhysicsTick Disabled)");
    }

    async reactToDamage() {
        const now = Date.now();
        if (now - this.lastDamageTime < 10000) return; // Cooldown 10s
        this.lastDamageTime = now;

        const toxicMessages = [
            "may doi day",
            "cho bo go phim da",
            "can than cai dau may",
            "dmm",
            "thich nho ko?"
        ];
        const message = toxicMessages[Math.floor(Math.random() * toxicMessages.length)];
        setImmediate(() => this.botCore.say(message));
        console.log("[Survival] Damage detected, chat sent async, combat continues.");
    }

    async tick() {
        if (!this.botCore.isInitialized) return;
        // SurvivalSystem no longer auto-executes. It waits for GoalManager.
        // But we still run background checks (like auto-totem or combat reflexes)
        await this.checkSurvival();
        await this.combatMovement();
    }

    /**
     * Called by GoalManager to bid for control
     */
    async getProposal() {
        // 1. Ask GoalArbitrator (The Biological Brain)
        const goalId = this.brain.evaluate(); // Returns 'critical_foraging', 'survival_health', 'idle', etc.

        let priority = 0;
        let executeFn = null;

        switch (goalId) {
            case 'critical_foraging':
                priority = 100; // Critical
                executeFn = () => {
                    console.log("[Survival] Executing Critical Foraging");
                    this.gatherer.findFood();
                };
                break;
            case 'survival_health':
                priority = 95;
                executeFn = () => console.log("[Survival] Seeking Safety/Health"); // TODO: Implement Shelter
                break;
            case 'survival_food':
                priority = 90;
                executeFn = () => this.gatherer.findFood();
                break;
            case 'daily_agenda':
                priority = 80; // High but overrideable by user
                executeFn = () => this.executeAgenda(this.brain.getDailyAgenda());
                break;
            case 'progression_iron':
                priority = 50;
                executeFn = () => this.miner.mineLevel(this.config.mining.ironLevel);
                break;
            case 'progression_diamond':
                priority = 40;
                executeFn = () => this.miner.mineLevel(this.config.mining.stripMineLevel);
                break;
            case 'progression_nether':
                priority = 30;
                executeFn = () => this.nether.findFortress();
                break;
            default:
                priority = 0;
                executeFn = () => { }; // Idle
        }

        if (priority > 0) {
            return {
                id: goalId,
                priority: priority,
                execute: executeFn
            };
        }
        return null; // No bid
    }

    executeAgenda(task) {
        console.log(`[Survival] Executing Agenda: ${task}`);
        // Basic mapping
        if (task.includes('mining')) this.miner.mineLevel(11);
        if (task.includes('farming')) console.log("Farming not implied yet");
    }

    // executeGoal(goalId) ... Deprecated by executeFn in proposal ...
}

module.exports = SurvivalSystem;
