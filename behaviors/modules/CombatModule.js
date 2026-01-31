class CombatModule {
    constructor(botCore) {
        this.botCore = botCore;
    }

    get bot() { return this.botCore.bot; }
    get mcData() { return this.botCore.mcData; }
    get primitives() { return this.botCore.primitives; }

    _getMaterialOrder() {
        return ['netherite', 'diamond', 'iron', 'stone', 'gold', 'wood', 'leather', 'chainmail'];
    }

    _getBestItem(items) {
        if (!items || items.length === 0) return null;
        const order = this._getMaterialOrder();
        return items.sort((a, b) => {
            const aMaterial = a.name.split('_')[0];
            const bMaterial = b.name.split('_')[0];
            return order.indexOf(aMaterial) - order.indexOf(bMaterial);
        })[0];
    }

    async attack_target(target_name) {
        const target = this.bot.nearestEntity(e =>
            (e.username === target_name || e.name === target_name) && e.isValid
        );
        if (!target) throw new Error(`Target '${target_name}' not found nearby.`);

        if (this.bot.pvp.target) this.bot.pvp.stop();
        this.bot.pvp.attack(target);
        console.log(`[CombatModule] Attacking ${target_name}!`);
    }

    async equip_best_weapon() {
        const weapons = this.bot.inventory.items().filter(item => {
            const itemData = this.mcData.itemsByName[item.name];
            return itemData && itemData.damage !== undefined;
        });

        if (weapons.length === 0) throw new Error("No weapons in inventory.");

        weapons.sort((a, b) => {
            const dmgA = this.mcData.items[a.type]?.damage || 0;
            const dmgB = this.mcData.items[b.type]?.damage || 0;
            return dmgB - dmgA;
        });

        await this.bot.equip(weapons[0], 'hand');
        console.log(`[CombatModule] Equipped: ${weapons[0].name}`);
    }

    async equip_best_armor() {
        console.log("[CombatModule] Checking and equipping armor...");
        const armorSlots = {
            head: this.bot.inventory.items().filter(item => item.name.endsWith('_helmet')),
            torso: this.bot.inventory.items().filter(item => item.name.endsWith('_chestplate')),
            legs: this.bot.inventory.items().filter(item => item.name.endsWith('_leggings')),
            feet: this.bot.inventory.items().filter(item => item.name.endsWith('_boots')),
        };

        for (const slot in armorSlots) {
            const bestItem = this._getBestItem(armorSlots[slot]);
            if (bestItem) {
                try {
                    await this.bot.equip(bestItem, slot);
                } catch (e) {
                    console.log(`Cannot equip ${bestItem.name} to ${slot}.`);
                }
            }
        }
        console.log("[CombatModule] Best armor equipped.");
    }
}

module.exports = CombatModule;
