// primitives.js (Layer 1: Muscles)
const { goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const { Vec3 } = require('vec3');

class Primitives {
    constructor(botCore) {
        this.botCore = botCore;
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
        const target = new Vec3(position.x, position.y, position.z);
        const botPos = this.bot.entity.position.offset(0, this.bot.entity.height, 0);
        const delta = target.minus(botPos);
        const yaw = Math.atan2(-delta.x, -delta.z);
        const groundDist = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
        const pitch = Math.atan2(delta.y, groundDist);

        const steps = 5;
        const currentYaw = this.bot.entity.yaw;
        const currentPitch = this.bot.entity.pitch;

        for (let i = 1; i <= steps; i++) {
            const interpolatedYaw = currentYaw + (yaw - currentYaw) * (i / steps);
            const interpolatedPitch = currentPitch + (pitch - currentPitch) * (i / steps);
            await this.bot.look(interpolatedYaw, interpolatedPitch, true);
            await new Promise(r => setTimeout(r, 20));
        }
    }

    async smartMove(goal) {
        const target = new Vec3(goal.x, goal.y, goal.z);
        this.bot.setControlState('sprint', true);

        const jumpInterval = setInterval(() => {
            if (this.bot.entity.onGround && this.bot.entity.position.distanceTo(target) > 5) {
                this.bot.setControlState('jump', true);
                setTimeout(() => this.bot.setControlState('jump', false), 50);
            }
        }, 500);

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
        // 'block' here implies the item in hand to place
        // 'face' needs to be a Vec3 vector (e.g., (0, 1, 0) for top)

        const targetPos = new Vec3(position.x, position.y, position.z);

        // Find a solid neighbor to place against
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

            // Check if valid reference block (solid, not liquid, not air)
            if (neighborBlock && neighborBlock.type !== 0 && !neighborBlock.liquid) { // 0 is Air
                // Found a valid support!
                // Place ON the neighbor, with the face pointing TOWARDS our target
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
        // Return simplified inventory
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
        const r = Math.min(radius, 32); // Limit radius for performance
        let processed = 0;

        for (let x = -r; x <= r; x++) {
            for (let y = -r; y <= r; y++) {
                for (let z = -r; z <= r; z++) {
                    // Yield to event loop every 1000 blocks to stay responsive
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
        // Random yaw/pitch variation
        const yaw = (Math.random() * Math.PI * 2) - Math.PI;
        const pitch = (Math.random() * Math.PI / 2) - (Math.PI / 4); // Don't look too far up/down
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
        // Generic trigger for holding down mouse buttons
        if (action_name === 'jump') this.bot.setControlState('jump', true);
        if (action_name === 'sneak') this.bot.setControlState('sneak', true);
        // For breaking, mineflayer uses dig(), but we can fake start via swing arm?
        // this.bot.swingArm();
    }

    async stop_action(action_name) {
        if (action_name === 'jump') this.bot.setControlState('jump', false);
        if (action_name === 'sneak') this.bot.setControlState('sneak', false);
    }

    async start_break(on = true) {
        // Manually trigger "attack" (left click) repeatedly or hold?
        // Mineflayer doesn't strictly support "hold left click" without digging a block.
        // We can use swingArm to simulate the visual.
        // Or actually attack/dig if looking at a block.
        if (on) {
            this.bot.swingArm();
            const block = this.bot.blockAtCursor(4);
            if (block) await this.bot.dig(block, 'ignore', 'raycast'); // Non-blocking dig attempt
        } else {
            this.bot.stopDigging();
        }
    }

    async stop_break() {
        this.bot.stopDigging();
    }

    // --- REFINEMENT PHASE: TROLL/HUMAN MOVEMENT ---

    async fidget() {
        // "Ngứa ngáy": Spam WASD randomly
        const controls = ['forward', 'back', 'left', 'right'];
        const control = controls[Math.floor(Math.random() * controls.length)];
        const duration = Math.floor(Math.random() * 200) + 100; // 100-300ms

        this.bot.setControlState(control, true);
        await new Promise(r => setTimeout(r, duration));
        this.bot.setControlState(control, false);
    }

    async human_move_to(position) {
        // "Nghiêng nghiêng rẽ vòng": Simple implementation by creating intermediate points with noise.
        // Or simpler: Just look slightly off-center while moving?
        // Mineflayer pathfinder is strict. We cannot easily inject "curve" into it.
        // Alternative: Use pathfinder to get NEAR, then handle last few blocks manually with noise.
        // Or: Just add random look noise during movement loop? (Need to hook into pathfinder events? Hard).

        // Simpler approach: Just use move_to for now but add a 'pre-movement' head turn
        // Real curved movement requires writing a new physics mover which is out of scope for "primitives".
        // Let's implement a "Lazy" move_to that stops short and wanders the rest?

        // User requested "nghiêng nghiêng rẽ vòng". 
        // Let's implement a manual move for short distance that strafes/curves.

        const target = new Vec3(position.x, position.y, position.z);
        const dist = this.bot.entity.position.distanceTo(target);

        if (dist < 10) {
            // Manual "Curved" move for short distance
            await this.bot.lookAt(target);
            // Offset yaw slightly
            const offset = (Math.random() * 0.4) - 0.2; // +/- 0.2 rad
            await this.bot.look(this.bot.entity.yaw + offset, this.bot.entity.pitch);

            this.bot.setControlState('forward', true);
            // Randomly strafe
            if (Math.random() < 0.3) this.bot.setControlState(Math.random() > 0.5 ? 'left' : 'right', true);

            // Wait loop
            while (this.bot.entity.position.distanceTo(target) > 1.5) {
                await new Promise(r => setTimeout(r, 100));
                // Correct course slowly
                await this.bot.lookAt(target);
                // Re-apply noise? No, coverge.
            }
            this.bot.clearControlStates();
        } else {
            // Long distance: use pathfinder but maybe look around?
            return this.move_to(position);
        }
    }
    async set_base() {
        if (!this.botCore.memory) throw new Error("Memory Manager not available");
        const pos = this.get_position();
        await this.botCore.memory.saveLocation('base', pos);
        this.botCore.say("Da danh dau can cu tai day! (Base Set)");
    }

    async guard_base(radius = 20) {
        // Phase 2 placeholder: Will delegate to GuardBehavior
        // For now, we just acknowledge
        this.botCore.say(`Bat che do bao ve ban kinh ${radius} blocks! (Base Guard On)`);

        // Trigger the Behavior if available (Phase 2)
        if (this.botCore.behaviors && this.botCore.behaviors.guard) {
            this.botCore.behaviors.guard.start(radius);
        } else {
            console.warn("GuardBehavior not yet implemented (Phase 2)");
        }
    }
}

module.exports = Primitives;
