class LavaAvoidance {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.mcData = null;
    }

    _loadData() {
        if (!this.mcData && this.bot.version) {
            this.mcData = require('minecraft-data')(this.bot.version);
        }
        return this.mcData;
    }

    setupPathfinder() {
        if (!this.bot.pathfinder) return;
        const mcData = this._loadData();
        if (!mcData) return;

        // Configure mineflayer-pathfinder to dislike lava heavily
        const movements = new this.botCore.pathfinder.Movements(this.bot, mcData);

        movements.liquidCost = 100; // High cost for water
        movements.lavaCost = 1000; // Extreme cost for lava

        this.bot.pathfinder.setMovements(movements);
        console.log("[Safety] Lava avoidance enabled.");
    }

    isSafe(pos) {
        if (!this.bot.entity) return true;
        const mcData = this._loadData();
        if (!mcData) return true;

        const block = this.bot.blockAt(pos);
        if (block && block.type === mcData.blocksByName.lava.id) return false;
        // Check surrounding?
        return true;
    }
}

module.exports = LavaAvoidance;
