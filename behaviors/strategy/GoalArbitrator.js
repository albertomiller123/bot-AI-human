// Danh sách thức ăn được chấp nhận (saturation từ cao đến thấp)
const ACCEPTABLE_FOODS = [
    'cooked_beef', 'cooked_porkchop', 'cooked_mutton',
    'cooked_chicken', 'cooked_rabbit', 'cooked_salmon',
    'cooked_cod', 'bread', 'baked_potato', 'golden_carrot',
    'golden_apple', 'apple', 'carrot', 'melon_slice', 'sweet_berries'
];

class GoalArbitrator {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        // Define hierarchy of needs/goals
        // FIX: Health priority (100) > Food priority (95)
        // Bot phải hồi máu trước khi đi tìm thức ăn
        this.goals = [
            { id: 'survival_health', priority: 100, check: () => this.needsHealth() },
            { id: 'survival_food', priority: 95, check: () => this.needsFood() },
            { id: 'progression_iron', priority: 50, check: () => this.needsIron() },
            { id: 'progression_diamond', priority: 40, check: () => this.needsDiamond() },
            { id: 'progression_nether', priority: 30, check: () => this.readyForNether() }
        ];

        this.currentGoal = null;
    }

    evaluate() {
        // Grand Strategy V2: Sanctuary Logic
        // If we are currently executing a complex goal (like mining or nether),
        // we should NOT switch goals unless:
        // 1. Critical Survival Need (Food < 6, Health < 10)
        // 2. We are in a "Sanctuary" (Home) equivalent state

        const critical = this.goals.filter(g => g.priority >= 90);
        for (const goal of critical) {
            if (goal.check()) return goal.id; // Emergency override
        }

        // If not critical, check if we should stick to current plan
        if (this.currentGoal && !this.isGoalComplete(this.currentGoal)) {
            // Sticky Goal: Don't change mind every second
            // Unless we are explicitly "Idle" or "Thinking"
            return this.currentGoal;
        }

        // Standard Evaluation (Ordered Hierarchy)
        for (const goal of this.goals.sort((a, b) => b.priority - a.priority)) {
            if (goal.check()) {
                if (this.currentGoal !== goal.id) {
                    console.log(`[Strategy] New Grand Goal: ${goal.id.toUpperCase()}`);
                    this.currentGoal = goal.id;
                    return goal.id;
                }
                return null;
            }
        }
        return 'idle';
    }

    isGoalComplete(goalId) {
        // Helper to check if current goal is satisfied
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return true;
        return !goal.check(); // If condition is false, goal is satisfied
    }

    // --- CONDITION CHECKS (Refined) ---

    needsFood() {
        // Start looking for food at 12, critical at 6
        // FIX: Count ALL acceptable foods, not just cooked_beef
        const totalFood = this.countTotalFood();
        return this.bot.food < 12 && totalFood < 16;
    }

    needsHealth() {
        return this.bot.health < 12; // Hurt
    }

    /**
     * Count total food items from acceptable food list
     */
    countTotalFood() {
        return ACCEPTABLE_FOODS.reduce((total, foodName) => {
            return total + this.countItem(foodName);
        }, 0);
    }

    needsIron() {
        if (this.needsFood() || this.needsHealth()) return false;
        // Need full iron set
        const fullSet = this.hasItem('iron_helmet') && this.hasItem('iron_chestplate')
            && this.hasItem('iron_leggings') && this.hasItem('iron_boots');
        return !fullSet;
    }

    needsDiamond() {
        if (this.needsIron()) return false; // Strict Hierarchy: Iron FIRST
        const fullSet = this.hasItem('diamond_helmet') && this.hasItem('diamond_chestplate');
        return !fullSet;
    }

    readyForNether() {
        if (this.needsDiamond()) return false; // Strict Hierarchy: Diamond FIRST
        // FIX: Use countTotalFood() instead of just cooked_beef
        const hasFood = this.countTotalFood() > 32;
        return hasFood;
    }

    // --- HELPERS ---

    countItem(name) {
        const item = this.bot.inventory.items().find(i => i.name.includes(name));
        return item ? item.count : 0;
    }

    hasItem(name) {
        return this.bot.inventory.items().some(i => i.name.includes(name));
    }
}

module.exports = GoalArbitrator;
