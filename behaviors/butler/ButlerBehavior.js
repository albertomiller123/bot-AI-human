const fs = require('fs');
const path = require('path');
const { goals, Movements } = require('mineflayer-pathfinder');

class ButlerBehavior {
    constructor(botCore) {
        this.botCore = botCore;
        // Note: Don't assign this.bot here - it's null at construction time
        this.configPath = path.join(__dirname, '../../data/butler_memory.json');

        // State
        this.state = 'idle'; // idle, following, going_home
        this.homePos = null;
        this.owner = null;

        this._loadMemory();
    }

    // Lazy getter - bot is only available after spawn
    get bot() { return this.botCore.bot; }

    _loadMemory() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath));
                this.homePos = data.homePos;
                console.log(`[Butler] Home loaded: ${JSON.stringify(this.homePos)}`);
            }
        } catch (e) {
            console.error("[Butler] Failed to load memory", e);
        }
    }

    _saveMemory() {
        try {
            const data = { homePos: this.homePos };
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("[Butler] Failed to save memory", e);
        }
    }

    setHome() {
        if (!this.bot?.entity) return "I don't exist yet.";
        this.homePos = this.bot.entity.position.clone();
        this._saveMemory();
        return `Home set to ${Math.round(this.homePos.x)}, ${Math.round(this.homePos.y)}, ${Math.round(this.homePos.z)}`;
    }

    async comeToOwner(username) {
        if (!this.bot) return "Bot not connected.";
        const target = this.bot.players[username]?.entity;
        if (!target) return "I can't see you.";

        this.state = 'following';
        this.owner = username;

        console.log(`[Butler] Following ${username}`);
        this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
        return "Coming!";
    }

    async stop() {
        this.state = 'idle';
        if (this.bot?.pathfinder) {
            this.bot.pathfinder.setGoal(null);
        }
        return "Stopping.";
    }

    async goHome() {
        if (!this.homePos) return "I have no home set.";

        this.state = 'going_home';
        console.log("[Butler] Returning to base...");

        const defaultMove = new Movements(this.bot);
        this.bot.pathfinder.setMovements(defaultMove);
        this.bot.pathfinder.setGoal(new goals.GoalNear(this.homePos.x, this.homePos.y, this.homePos.z, 1));

        return "Returning to sanctuary.";
    }

    // Sanctuary Protocol: Secure base before thinking
    async secureBase() {
        if (this.state !== 'at_home') await this.goHome();

        // Simple door closing logic (check nearby doors)
        const door = this.bot.findBlock({
            matching: blk => blk.name.includes('door') && blk.metadata < 4, // Closed? Open? Metadata varies by version, simplistic check
            maxDistance: 4
        });

        if (door) {
            // activate to close/open
            // Real impl needs complex state check, for MVP just generic interaction if needed
            // await this.bot.activateBlock(door);
        }
    }
}

module.exports = ButlerBehavior;
