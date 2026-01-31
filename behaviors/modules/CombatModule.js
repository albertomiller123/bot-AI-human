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

        // 1. Tactical Retreat (Health Check)
        if (this.bot.health < 6) {
            console.log("[Combat] Low health! Retreating...");
            this.bot.pvp.stop();
            const retreatPos = this.bot.entity.position.minus(target.position.minus(this.bot.entity.position).normalize().scaled(10));
            await this.primitives.move_to(retreatPos);
            return;
        }

        // 2. Ranged Combat (Bow Check)
        const dist = this.bot.entity.position.distanceTo(target.position);
        const bow = this.bot.inventory.items().find(i => i.name === 'bow');
        const arrow = this.bot.inventory.items().find(i => i.name === 'arrow');

        if (dist > 8 && bow && arrow) {
            console.log("[Combat] Engaging with Bow 🏹");
            this.bot.pvp.stop();
            await this.bot.equip(bow, 'hand');
            await this.bot.lookAt(target.position.offset(0, target.height * 0.5, 0));
            this.bot.activateItem(); // pull
            await new Promise(r => setTimeout(r, 1000)); // charge
            this.bot.deactivateItem(); // fire
            return;
        }

        // 3. Melee (Standard)
        if (this.bot.pvp.target !== target) {
            console.log(`[CombatModule] Melee Charge: ${target_name}!`);
            this.bot.pvp.attack(target);
        }
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
