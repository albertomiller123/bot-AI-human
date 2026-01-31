// primitives.js (Layer 1: Muscles)
const { goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const { Vec3 } = require('vec3');
const HumanMotor = require('./humanizer/HumanMotor');

class Primitives {
    constructor(botCore) {
        this.botCore = botCore;
        this.humanMotor = new HumanMotor(botCore.bot); // Inject Middleware
    }

    get bot() { return this.botCore.bot; }

    // --- ACTIONS ---

    async move_to(position) {
        // Automatically use human-like movement for short distances
        const target = new Vec3(position.x, position.y, position.z);
        const dist = this.bot.entity.position.distanceTo(target);

        if (dist < 10 && dist > 1) {
            return this.human_move_to(position);
        }

        if (dist > 30) {
            return this.smartMove(position);
        }

        return this._pathfind_move(position);
    }

    async smoothLookAt(position) {
        // Delegated to HumanMotor
        const target = new Vec3(position.x, position.y, position.z);
        await this.humanMotor.smoothLookAt(target);
    }

    async smartMove(goal) {
        const target = new Vec3(goal.x, goal.y, goal.z);
        this.bot.setControlState('sprint', true);

        // OPTIMIZATION: Fixed "Crit Jump" bunny hopping
        // Only jump if we are actually stuck against a block
        const jumpInterval = setInterval(() => {
            if (this.bot.entity.onGround && this.bot.entity.isCollidedHorizontally) {
                this.bot.setControlState('jump', true);
                setTimeout(() => this.bot.setControlState('jump', false), 50);
            }
        }, 100); // Check more frequently (100ms) but jump less often

        try {
            await this._pathfind_move(goal);
        } finally {
            clearInterval(jumpInterval);
            this.bot.setControlState('sprint', false);
        }
    }

    async _pathfind_move(position) {
        if (!this.bot.pathfinder) throw new Error("Pathfinder not loaded");
        // Support both Vec3 and {x,y,z} object
        const x = position.x;
        const y = position.y;
        const z = position.z;
        await this.bot.pathfinder.goto(new GoalBlock(x, y, z));
    }

    async look_at(position) {
        await this.smoothLookAt(position);
    }

    async instant_look_at(position) {
        const target = new Vec3(position.x, position.y, position.z);
        await this.bot.lookAt(target);
    }

    async jump() {
        this.bot.setControlState('jump', true);
        await new Promise(r => setTimeout(r, 100)); // Wait for physics tick
        this.bot.setControlState('jump', false);
    }

    async sneak(on) {
        this.bot.setControlState('sneak', on);
    }

    async stop() {
        this.bot.pathfinder.stop();
        this.bot.clearControlStates();
    }

    async place_block(block, position, face) {
        const targetPos = new Vec3(position.x, position.y, position.z);

        const neighbors = [
            { vec: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) }, // Top of block below
            { vec: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) }, // Bottom of block above
            { vec: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) }, // North side
            { vec: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) }, // South side
            { vec: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) }, // West side
            { vec: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) }  // East side
        ];

        for (const n of neighbors) {
            const neighborPos = targetPos.plus(n.vec);
            const neighborBlock = this.bot.blockAt(neighborPos);

            if (neighborBlock && neighborBlock.type !== 0 && !neighborBlock.liquid) { // 0 is Air
                await this.bot.placeBlock(neighborBlock, n.face);
                return;
            }
        }

        throw new Error(`Cannot place block at ${targetPos}: No support block found.`);
    }

    async break_block(position) {
        const targetPos = new Vec3(position.x, position.y, position.z);
        const block = this.bot.blockAt(targetPos);
        if (block && block.name !== 'air') {
            await this.bot.dig(block);
        }
    }

    async use_item(item_name) {
        const item = this.bot.inventory.items().find(i => i.name === item_name);
        if (item) {
            await this.bot.equip(item, 'hand');
            this.bot.activateItem();
        }
    }

    // --- SENSORS ---

    get_position() {
        return this.bot.entity.position.clone();
    }

    get_inventory() {
        return this.bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count,
            slot: item.slot
        }));
    }

    get_block(position) {
        const pos = new Vec3(position.x, position.y, position.z);
        return this.bot.blockAt(pos);
    }

    async scan_area(radius) {
        const center = this.bot.entity.position;
        const results = [];
        const r = Math.min(radius, 32);
        let processed = 0;

        for (let x = -r; x <= r; x++) {
            for (let y = -r; y <= r; y++) {
                for (let z = -r; z <= r; z++) {
                    if (++processed % 1000 === 0) {
                        await new Promise(resolve => setImmediate(resolve));
                    }
                    const pos = center.offset(x, y, z);
                    const block = this.bot.blockAt(pos);
                    if (block && block.name !== 'air') {
                        results.push({
                            name: block.name,
                            position: pos.floored()
                        });
                    }
                }
            }
        }
        return results;
    }

    // --- TIER 1: MICRO ACTIONS ---

    async look_random() {
        const yaw = (Math.random() * Math.PI * 2) - Math.PI;
        const pitch = (Math.random() * Math.PI / 2) - (Math.PI / 4);
        await this.bot.look(yaw, pitch);
    }

    async turn_head(angle_degrees) {
        const currentYaw = this.bot.entity.yaw;
        const angleRad = angle_degrees * (Math.PI / 180);
        await this.bot.look(currentYaw + angleRad, this.bot.entity.pitch);
    }

    async step_forward(on = true) { this.bot.setControlState('forward', on); }
    async step_back(on = true) { this.bot.setControlState('back', on); }
    async strafe_left(on = true) { this.bot.setControlState('left', on); }
    async strafe_right(on = true) { this.bot.setControlState('right', on); }

    async swap_hotbar(slot) {
        if (slot < 0 || slot > 8) throw new Error("Hotbar slot must be 0-8");
        this.bot.setQuickBarSlot(slot);
    }

    async start_action(action_name) {
        if (action_name === 'jump') this.bot.setControlState('jump', true);
        if (action_name === 'sneak') this.bot.setControlState('sneak', true);
    }

    async stop_action(action_name) {
        if (action_name === 'jump') this.bot.setControlState('jump', false);
        if (action_name === 'sneak') this.bot.setControlState('sneak', false);
    }

    async start_break(on = true) {
        if (on) {
            this.bot.swingArm();
            const block = this.bot.blockAtCursor(4);
            if (block) await this.bot.dig(block, 'ignore', 'raycast');
        } else {
            this.bot.stopDigging();
        }
    }

    async stop_break() {
        this.bot.stopDigging();
    }

    // --- HUMAN INTERFACE (Delegated to Middleware) ---

    async fidget() {
        // Could delegate to HumanMotor too, but keeping simple for now
        const controls = ['forward', 'back', 'left', 'right'];
        const control = controls[Math.floor(Math.random() * controls.length)];
        const duration = Math.floor(Math.random() * 200) + 100;
        this.bot.setControlState(control, true);
        await new Promise(r => setTimeout(r, duration));
        this.bot.setControlState(control, false);
    }

    async human_move_to(position) {
        const target = new Vec3(position.x, position.y, position.z);
        await this.humanMotor.humanRelMove(target);
    }

    async set_base() {
        if (!this.botCore.memory) throw new Error("Memory Manager not available");
        const pos = this.get_position();
        await this.botCore.memory.saveLocation('base', pos);
        this.botCore.say("Da danh dau can cu tai day! (Base Set)");
    }

    async go_base() {
        if (!this.botCore.memory) throw new Error("Memory Manager not available");
        const location = await this.botCore.memory.getLocation('base');
        if (!location) {
            this.botCore.say("Base location not found.");
            return false;
        }
        await this.bot.pathfinder.goto(new GoalBlock(location.x, location.y, location.z));
        this.botCore.say("Welcome home.");
        return true;
    }

    async guard_base(radius = 20) {
        this.botCore.say(`Bat che do bao ve ban kinh ${radius} blocks! (Base Guard On)`);
        if (this.botCore.behaviors && this.botCore.behaviors.guard) {
            this.botCore.behaviors.guard.start(radius);
        } else {
            console.warn("GuardBehavior not available");
        }
    }
}

module.exports = Primitives;
