class VillagerTrader {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.currentVillager = null;
    }

    async scanNearbyTrades() {
        if (!this.bot) return [];
        const villagers = Object.values(this.bot.entities).filter(e => e.displayName === 'Villager' && this.bot.entity.position.distanceTo(e.position) < 5);

        console.log(`[Economy] Found ${villagers.length} villagers nearby.`);

        const trades = [];
        for (const v of villagers) {
            try {
                const win = await this.bot.openVillager(v);
                console.log(`[Economy] Talking to villager ${v.id}...`);

                win.trades.forEach((trade, index) => {
                    const input = trade.inputItem.count + ' ' + trade.inputItem.name;
                    const output = trade.outputItem.count + ' ' + trade.outputItem.name;
                    console.log(`[Economy] Trade #${index}: ${input} -> ${output}`);
                    trades.push({ villagerId: v.id, index, input, output });
                });

                win.close();
                await new Promise(r => setTimeout(r, 1000)); // Delay between checks
            } catch (e) {
                console.error(`[Economy] Failed to trade with ${v.id}: ${e.message}`);
            }
        }
        return trades;
    }

    async trade(villagerId, tradeIndex, count = 1) {
        const villager = this.bot.entities[villagerId];
        if (!villager) {
            console.error("[Economy] Villager not found/in range.");
            return false;
        }

        try {
            const win = await this.bot.openVillager(villager);
            const trade = win.trades[tradeIndex];
            if (!trade) {
                console.error("[Economy] Invalid trade index");
                win.close();
                return false;
            }

            console.log(`[Economy] Trading ${count} times...`);
            await this.bot.trade(win, tradeIndex, count);
            win.close();
            return true;
        } catch (e) {
            console.error("[Economy] Trade failed:", e);
            return false;
        }
    }
}

module.exports = VillagerTrader;
