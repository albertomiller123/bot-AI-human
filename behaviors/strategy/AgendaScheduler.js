/**
 * AgendaScheduler.js - Mission Control for Endless Mode
 * 
 * Generates a "Daily Plan" for the bot based on in-game time and current status.
 * Ensures the bot always has something to do, preventing "stand still" behavior.
 */
class AgendaScheduler {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.currentAgenda = null;
        this.lastDay = -1;

        this.availableTasks = [
            'farming_wheat',
            'mining_iron',
            'building_base',
            'fishing',
            'exploring'
        ];
    }

    /**
     * Get the current agenda for this in-game day
     */
    getAgenda() {
        const time = this.bot.time.timeOfDay;
        const day = this.bot.time.day;

        // New Day = New Plan
        if (day > this.lastDay) {
            this.generateDailyPlan(day);
            this.lastDay = day;
        }

        // Night time logic override (if not mining/building indoors)
        if (time > 13000 && time < 23000) {
            // Force sleep or safe idle if outside
            // For now, let's keep the daily agenda but maybe switch modifiers
        }

        return this.currentAgenda;
    }

    generateDailyPlan(day) {
        // Simple Rotation for MVP
        // In future: Use VectorDB to decide what's needed
        const taskIndex = day % this.availableTasks.length;
        this.currentAgenda = this.availableTasks[taskIndex];

        console.log(`[Mission Control] 📅 Day ${day} Agenda: ${this.currentAgenda.toUpperCase()}`);

        // Notify user via chat (Optional debug)
        // this.bot.chat(`Day ${day}: Today I will focus on ${this.currentAgenda}`);
    }
}

module.exports = AgendaScheduler;
