class ItemEvaluator {
    constructor(botCore) {
        this.botCore = botCore; // Config access if needed

        this.SCORES = {
            TIER: {
                netherite: 1000,
                diamond: 500,
                iron: 100,
                stone: 50,
                wood: 10,
                golden: 20 // Gold is weak but enchantable. Low score for generic use.
            },

            ENCHANT: {
                // S Tier
                mending: 200,
                sharpness: 50, // Per level
                protection: 50, // Per level
                efficiency: 40,
                fortune: 60,
                looting: 60,
                power: 50,

                // A Tier
                unbreaking: 20,
                feather_falling: 30,
                depth_strider: 30,
                fire_aspect: 20,

                // Trash Tier
                bane_of_arthropods: -10, // Dilutes pool for god rolls
                curse_of_vanishing: -50,
                curse_of_binding: -100
            },

            TYPE: {
                totem_of_undying: 2000,
                enchanted_golden_apple: 1500, // God Apple
                golden_apple: 300,
                end_crystal: 100,
                obsidian: 20,
                diamond_block: 4500, // 9 * 500
                iron_block: 900
            }
        };
    }

    /**
     * Calculate a numerical score for an Item
     * @param {Item} item - Mineflayer Item
     * @returns {number} score
     */
    getItemScore(item) {
        if (!item) return 0;

        let score = 0;
        const name = item.name;

        // 1. Base Type Score
        if (this.SCORES.TYPE[name]) {
            score += this.SCORES.TYPE[name];
        }

        // 2. Material Tier Score
        for (const tier in this.SCORES.TIER) {
            if (name.includes(tier)) {
                score += this.SCORES.TIER[tier];
                break;
            }
        }

        // 3. Enchantments Analysis (NBT)
        // Mineflayer items usually parse enchants into `item.enchants` array of objects { name, lvl }
        if (item.enchants) {
            for (const ench of item.enchants) {
                // Handle raw minecraft names 'minecraft:sharpness' -> 'sharpness'
                const cleanName = ench.name.replace('minecraft:', '');
                const lvl = ench.lvl || 1;

                const weight = this.SCORES.ENCHANT[cleanName] || 0;

                // Multiply linear enchants by level (Sharpness V = 5 * 50 = 250)
                // Mending (max lvl 1) = 200
                score += weight * lvl;
            }
        } else if (item.nbt && item.nbt.value && item.nbt.value.StoredEnchantments) {
            // Logic for Enchanted Books (StoredEnchantments)
            const stored = item.nbt.value.StoredEnchantments.value.value || item.nbt.value.StoredEnchantments.value;
            if (Array.isArray(stored)) {
                for (const enchTag of stored) {
                    const enchId = enchTag.id.value.replace('minecraft:', '');
                    const lvl = enchTag.lvl.value;
                    const weight = this.SCORES.ENCHANT[enchId] || 0;
                    score += weight * lvl;
                }
            }
        }

        return score * item.count;
    }

    /**
     * Returns the better item between two options
     */
    pickBetter(itemA, itemB) {
        const scoreA = this.getItemScore(itemA);
        const scoreB = this.getItemScore(itemB);
        return scoreA >= scoreB ? itemA : itemB;
    }

    /**
     * Should we keep this item given our inventory state?
     * (Placeholder for future rigorous logic)
     */
    shouldKeep(item) {
        // Always keep high value items
        if (this.getItemScore(item) > 100) return true;

        // Trash filters
        if (['rotten_flesh', 'dirt', 'cobblestone', 'seed'].includes(item.name)) {
            // Keep stacks of blocks? Context dependent.
            // For now, assume yes unless explicitly purging.
            return true;
        }

        return true;
    }
}

module.exports = ItemEvaluator;
