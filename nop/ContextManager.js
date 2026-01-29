const { Vec3 } = require('vec3');

class ContextManager {
    constructor(botCore) {
        this.botCore = botCore;
    }

    getLiteContext(username) {
        const bot = this.botCore.bot;
        return {
            command_by: username,
            health: bot.health,
            food: bot.food,
            position: bot.entity.position.floored(),
            is_busy: this.botCore.taskManager.isBusy
        };
    }

    async getFullContext(username) {
        const bot = this.botCore.bot;
        const botPos = bot.entity.position;
        const base = this.getLiteContext(username);

        // Get Base Info
        let baseInfo = "Base location: Unknown (User Action 'set_base' needed)";
        if (this.botCore.memoryManager) {
            try {
                const baseLoc = await this.botCore.memoryManager.getLocation('base');
                if (baseLoc) {
                    const dist = botPos.distanceTo(new Vec3(baseLoc.x, baseLoc.y, baseLoc.z));
                    baseInfo = `Base location: ${Math.round(dist)} blocks away. (You are ${dist < 30 ? "AT BASE" : "AWAY"})`;
                }
            } catch (e) {
                console.error("Failed to load base loc:", e);
            }
        }

        // TOKEN OPTIMIZATION: Top 5 closest/dangerous mobs only
        const nearbyMobs = Object.values(bot.entities)
            .filter(e => (e.type === 'mob' || e.type === 'hostile') && e.position.distanceTo(botPos) < 32)
            .sort((a, b) => a.position.distanceTo(botPos) - b.position.distanceTo(botPos))
            .slice(0, 5)
            .map(e => ({ name: e.name, dist: Math.round(e.position.distanceTo(botPos)) }));

        // TOKEN OPTIMIZATION: Grouped inventory by category
        const inventory = this._groupInventory(bot.inventory.items());

        // TOKEN OPTIMIZATION: Only locations within 100 blocks
        // Note: For now still using ltm.locations cache if exists, or fetch all from DB if needed. 
        // Keeping legacy ltm check for robustness until full migration.
        const nearbyLocations = Object.entries(this.botCore.ltm.locations || {})
            .filter(([_, loc]) => {
                const locVec = new Vec3(loc.x, loc.y, loc.z);
                return locVec.distanceTo(botPos) < 100;
            })
            .map(([name]) => name);

        // TOKEN OPTIMIZATION: Limited nearby players
        const nearbyPlayers = Object.values(bot.players)
            .filter(p => p.entity)
            .slice(0, 5)
            .map(p => ({ name: p.username, dist: Math.round(p.entity.position.distanceTo(botPos)) }));

        return {
            ...base,
            base_status: baseInfo,
            inventory,
            nearby_players: nearbyPlayers,
            nearby_mobs: nearbyMobs,
            known_locations: nearbyLocations,
            time: bot.time.timeOfDay,
            is_day: bot.time.isDay
        };
    }

    _groupInventory(items) {
        const groups = {
            weapons: [],
            tools: [],
            armor: [],
            blocks: [],
            food: [],
            misc: []
        };

        for (const item of items) {
            const name = item.name;
            if (name.endsWith('_sword') || name.endsWith('_axe') || name === 'bow' || name === 'crossbow' || name === 'trident') {
                groups.weapons.push({ name, count: item.count });
            } else if (name.endsWith('_pickaxe') || name.endsWith('_shovel') || name.endsWith('_hoe')) {
                groups.tools.push({ name, count: item.count });
            } else if (name.endsWith('_helmet') || name.endsWith('_chestplate') || name.endsWith('_leggings') || name.endsWith('_boots')) {
                groups.armor.push({ name, count: item.count });
            } else if (this.botCore.mcData?.foods?.[item.type]) {
                groups.food.push({ name, count: item.count });
            } else if (this.botCore.mcData?.blocks?.[item.type]) {
                groups.blocks.push({ name, count: item.count });
            } else {
                groups.misc.push({ name, count: item.count });
            }
        }

        // Summarize as concise string to reduce tokens
        const summary = [];
        for (const [cat, catItems] of Object.entries(groups)) {
            if (catItems.length > 0) {
                const itemStr = catItems.map(i => `${i.count}x ${i.name}`).join(', ');
                summary.push(`${cat}: ${itemStr}`);
            }
        }
        return summary.join(' | ');
    }

    getCombatContext() {
        const bot = this.botCore.bot;
        const botPos = bot.entity.position;

        const attackers = Object.values(bot.entities)
            .filter(e => e.type === 'hostile' && e.position.distanceTo(botPos) < 10)
            .slice(0, 5) // Limit to 5 threats
            .map(e => ({ name: e.name, dist: Math.round(e.position.distanceTo(botPos)) }));

        return {
            health: bot.health,
            food: bot.food,
            nearby_hostiles: attackers,
            equipment: {
                hand: bot.heldItem?.name,
                offhand: bot.inventory.slots[45]?.name
            }
        };
    }
}

module.exports = ContextManager;
