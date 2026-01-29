// utils.js

function calculateEffectiveDamage(item, mcData) {
    if (!item) return 0;
    
    // Lấy sát thương gốc
    let totalDamage = mcData.items[item.type]?.damage || 0;

    // Kiểm tra và cộng dồn sát thương từ phù phép "Sharpness"
    if (item.nbt?.value?.Enchantments?.value?.value) {
        const enchantments = item.nbt.value.Enchantments.value.value;
        for (const ench of enchantments) {
            if (ench.id.value === 'minecraft:sharpness') {
                const level = ench.lvl.value;
                // Công thức tính bonus damage của Sharpness trong Java Edition
                const bonusDamage = 0.5 * level + 0.5;
                totalDamage += bonusDamage;
            }
        }
    }
    return totalDamage;
}

module.exports = {
    calculateEffectiveDamage,
};