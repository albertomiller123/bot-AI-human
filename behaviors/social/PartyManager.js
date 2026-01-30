const { goals } = require('mineflayer-pathfinder');

class PartyManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;
        this.members = new Set();
        this.leader = null;
        this.isFollowing = false;

        // Expose to botCore
        this.botCore.party = this;
    }

    addMember(username) {
        this.members.add(username);
        console.log(`[Party] Added member: ${username}`);
        if (this.botCore.humanizer) this.botCore.humanizer.say(`Welcome to the party, ${username}!`);
    }

    removeMember(username) {
        this.members.delete(username);
        if (this.leader === username) {
            this.leader = null;
            this.stopFollowing();
        }
        console.log(`[Party] Removed member: ${username}`);
    }

    isMember(username) {
        return this.members.has(username);
    }

    setLeader(username) {
        if (this.isMember(username) || username === this.botCore.context?.masterUser) {
            this.leader = username;
            console.log(`[Party] Leader set to: ${username}`);
            this.startFollowing();
        }
    }

    async startFollowing() {
        if (!this.leader || this.isFollowing) return;
        this.isFollowing = true;
        console.log(`[Party] Following leader: ${this.leader}`);

        const followLoop = async () => {
            if (!this.isFollowing || !this.leader) return;

            const target = this.bot.players[this.leader]?.entity;
            if (!target) {
                // Leader out of range or not logged in
                // console.log("[Party] Leader not visible...");
                setTimeout(followLoop, 2000);
                return;
            }

            const dist = this.bot.entity.position.distanceTo(target.position);

            // Formation Logic: Keep distance 3-5 blocks, don't hug
            if (dist > 5) {
                try {
                    const goal = new goals.GoalFollow(target, 4);
                    this.bot.pathfinder.setGoal(goal, true);
                } catch (e) { }
            } else if (dist < 2) {
                // Too close, back off? Or just stop.
                this.bot.pathfinder.setGoal(null);
            }

            setTimeout(followLoop, 1000);
        };
        followLoop();
    }

    stopFollowing() {
        this.isFollowing = false;
        this.bot.pathfinder.setGoal(null);
        console.log("[Party] Stopped following.");
    }

    // Assist Logic: Attack what the leader is attacking
    monitorCombat() {
        // To be implemented: scan leader's target
        setInterval(() => {
            if (!this.leader || !this.isFollowing) return;
            const leaderEntity = this.bot.players[this.leader]?.entity;
            if (!leaderEntity) return;

            // Heuristic: If leader is swinging arm and looking at an entity close by
            // Or use 'entityHurt' event to see if leader caused damage
        }, 500);
    }
}

module.exports = PartyManager;
