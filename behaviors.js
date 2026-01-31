const { Vec3 } = require('vec3');
const fs = require('fs').promises;
const Humanizer = require('./humanizer');
const GuardBehavior = require('./behaviors/GuardBehavior');

// Enterprise Modules
const MiningModule = require('./behaviors/modules/MiningModule');
const CraftingModule = require('./behaviors/modules/CraftingModule');
const CombatModule = require('./behaviors/modules/CombatModule');

class Behaviors {
    constructor(botCore) {
        this.botCore = botCore;
        this.primitives = botCore.primitives;
        this.guard = new GuardBehavior(botCore);

        // Initialize Modules
        this.mining = new MiningModule(botCore);
        this.crafting = new CraftingModule(botCore);
        this.combat = new CombatModule(botCore);
    }

    /**
     * Silent Guardian Protocol wrapper
     */
    async guardian_mode(error, whisper_to) {
        console.log(`[Behaviors] Triggering Guardian Mode: ${error}`);
        if (whisper_to && this.botCore.config.owner) {
            // Ensure owner config is set properly if passed
        }
        await this.botCore.activateGuardianMode(error);
        return { success: true, message: "Guardian Protocol Activated" };
    }

    get bot() { return this.botCore.bot; }
    get mcData() { return this.botCore.mcData; }

    // --- UTILS ---
    async _checkToolFor(block) {
        // Delegated to MiningModule normally, but kept here if used by legacy or other scripts directly
        if (!block.canHarvest(this.bot.heldItem ? this.bot.heldItem.type : null)) {
            await this.bot.tool.equipForBlock(block, {});
            if (!block.canHarvest(this.bot.heldItem ? this.bot.heldItem.type : null)) {
                throw new Error(`Cannot harvest ${block.name} with current tool.`);
            }
        }
    }

    // --- FACADE METHODS (Backward Compatibility) ---

    // Mining Delegate
    async mine_block(type_name, count = 1) { return this.mining.mine_block(type_name, count); }
    async human_mine(type_name, count) { return this.mining.human_mine(type_name, count); }

    // Crafting Delegate
    async craft_item(item_name, count = 1) { return this.crafting.craft_item(item_name, count); }
    async craft_if_possible(item_name) { return this.crafting.craft_if_possible(item_name); }

    // Combat Delegate
    async attack_target(target_name) { return this.combat.attack_target(target_name); }
    async equip_best_weapon() { return this.combat.equip_best_weapon(); }
    async equip_best_armor() { return this.combat.equip_best_armor(); }

    async equip_best_tool() {
        this.combat.equip_best_tool();
    }

    // --- LEGACY / UTILS ---

    async eat_food() {
        try {
            const food = this.bot.inventory.items().find(item => this.mcData.foods[item.type]);
            if (!food) {
                return { success: false, message: "No food in inventory." };
            }

            await this.bot.equip(food, 'hand');
            await this.bot.consume();
            return { success: true, message: `Ate ${food.name}`, data: { food: food.name } };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async pathfind_to(position) {
        try {
            await this.primitives.move_to(position);
            return { success: true, message: `Moved to ${position.x}, ${position.y}, ${position.z}`, data: { position } };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async follow_player(name) {
        try {
            const target = this.bot.players[name]?.entity;
            if (!target) {
                return { success: false, message: `Player ${name} not found.` };
            }

            const { GoalFollow } = require('mineflayer-pathfinder').goals;
            this.bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
            return { success: true, message: `Following ${name}`, data: { target: name } };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async build_area(block_name, area) {
        // Area: { min: {x,y,z}, max: {x,y,z} }
        const minX = Math.min(area.min.x, area.max.x);
        const maxX = Math.max(area.min.x, area.max.x);
        const minY = Math.min(area.min.y, area.max.y);
        const maxY = Math.max(area.min.y, area.max.y);
        const minZ = Math.min(area.min.z, area.max.z);
        const maxZ = Math.max(area.min.z, area.max.z);

        const item = this.bot.inventory.items().find(i => i.name === block_name);
        if (!item) throw new Error(`Block ${block_name} not in inventory.`);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const pos = new Vec3(x, y, z);
                    const existing = this.bot.blockAt(pos);
                    if (existing && existing.name !== 'air') continue;

                    const currentItem = this.bot.inventory.items().find(i => i.name === block_name);
                    if (!currentItem) throw new Error(`Ran out of ${block_name}`);

                    const below = this.bot.blockAt(pos.offset(0, -1, 0));
                    if (!below || below.name === 'air') throw new Error(`Cannot place at ${pos}, no support block below.`);

                    await this.primitives.move_to(pos.offset(2, 0, 0));
                    await this.primitives.use_item(block_name);
                    await this.bot.placeBlock(below, new Vec3(0, 1, 0));
                }
            }
        }
    }

    async clear_area(area) {
        const minX = Math.min(area.min.x, area.max.x);
        const maxX = Math.max(area.min.x, area.max.x);
        const minY = Math.min(area.min.y, area.max.y);
        const maxY = Math.max(area.min.y, area.max.y);
        const minZ = Math.min(area.min.z, area.max.z);
        const maxZ = Math.max(area.min.z, area.max.z);

        for (let y = maxY; y >= minY; y--) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const pos = new Vec3(x, y, z);
                    const block = this.bot.blockAt(pos);
                    if (block && block.name !== 'air') {
                        await this.primitives.move_to(pos);
                        await this.primitives.break_block(pos);
                    }
                }
            }
        }
    }

    async wander_random(radius = 16) {
        const x = this.bot.entity.position.x + (Math.random() * radius * 2 - radius);
        const z = this.bot.entity.position.z + (Math.random() * radius * 2 - radius);
        const y = this.bot.entity.position.y;
        await this.primitives.move_to({ x, y, z });
        await Humanizer.random_delay(1000, 3000);
    }

    async human_build(block_name, area) {
        await this.build_area(block_name, area);
    }

    async stop_and_wait(seconds) {
        await this.primitives.stop();
        await Humanizer.delay(seconds * 1000);
    }

    async place_block_slow(block_name, position, face) {
        await Humanizer.hesitate(0.5);
        const item = this.bot.inventory.items().find(i => i.name === block_name);
        if (!item) throw new Error("Item not found");
        await this.primitives.use_item(block_name);
        await this.primitives.place_block(item, position, face);
    }

    async misplace_block(block_name, intended_position) {
        const offsetX = Math.random() > 0.5 ? 1 : -1;
        const wrongPos = new Vec3(intended_position.x + offsetX, intended_position.y, intended_position.z);
        try {
            await this.place_block_slow(block_name, wrongPos, { x: 0, y: 1, z: 0 });
            return wrongPos;
        } catch (e) { return null; }
    }

    async remove_wrong_block(position) {
        await Humanizer.hesitate(1);
        await this.primitives.look_at(position);
        await this.primitives.break_block(position);
    }

    async flatten_area(corner1, corner2) {
        const minX = Math.min(corner1.x, corner2.x);
        const maxX = Math.max(corner1.x, corner2.x);
        const minY = Math.min(corner1.y, corner2.y);
        const maxY = Math.max(corner1.y, corner2.y);
        const minZ = Math.min(corner1.z, corner2.z);
        const maxZ = Math.max(corner1.z, corner2.z);
        const targetY = minY;

        console.log(`[Behaviors] Flattening area...`);

        for (let y = maxY; y >= minY; y--) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const pos = new Vec3(x, y, z);
                    const block = this.bot.blockAt(pos);
                    if (y > targetY && block && block.name !== 'air') {
                        await this.primitives.move_to(pos);
                        await this.primitives.break_block(pos);
                    }
                }
            }
        }
    }

    async find_and_collect(item_name, qty = 1) {
        const blockType = this.mcData.blocksByName[item_name];
        if (!blockType) throw new Error(`Unknown block '${item_name}'.`);
        const blocks = await this.bot.findBlocks({ matching: blockType.id, maxDistance: 64, count: qty * 2 });
        if (blocks.length === 0) throw new Error(`Block '${item_name}' not found nearby.`);
        const targets = blocks.map(p => this.bot.blockAt(p)).slice(0, qty);
        await this.bot.collectBlock.collect(targets);
    }

    async give_item_to_player(username, item_name, quantity = 1) {
        const target = this.bot.players[username]?.entity;
        if (!target) throw new Error(`Player '${username}' not found.`);
        const item = this.bot.inventory.items().find(i => i.name === item_name);
        if (!item) throw new Error(`No '${item_name}' in inventory.`);
        await this.bot.lookAt(target.position.offset(0, 1.6, 0));
        await this.bot.toss(item.type, null, quantity);
    }

    async eat_until_full() {
        while (this.bot.food < 20) {
            if (!this.bot.canEat()) break;
            await this.eat_food();
            await new Promise(r => setTimeout(r, 250));
        }
    }

    async say_message(m) { this.botCore.say(m); }
    async stop_actions() { this.botCore.taskManager.stopCurrentTask(); if (this.guard) this.guard.stop(); }

    async remember_location(name) {
        const pos = this.bot.entity.position;
        if (!name) name = `loc_${Date.now()}`;
        await this.botCore.memory.saveLocation(name, { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) });
        this.botCore.locationsCache[name] = pos;
        return { success: true, message: `Saved location ${name}` };
    }

    async fake_afk(s) { await Humanizer.fake_afk(this.botCore, s); return { success: true }; }

    async look_at_player(name) {
        const player = this.bot.players[name]?.entity;
        if (player) { await this.primitives.look_at(player.position.offset(0, 1.6, 0)); return { success: true }; }
        return { success: false };
    }

    async set_base() { await this.primitives.set_base(); return { success: true }; }
    async guard_base(p) { await this.primitives.guard_base(p.radius); return { success: true }; }
    async stop_guard() { if (this.guard) this.guard.stop(); return { success: true }; }
}

module.exports = Behaviors;
