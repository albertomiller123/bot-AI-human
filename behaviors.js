const { Vec3 } = require('vec3');
const fs = require('fs').promises;
const Humanizer = require('./humanizer');
const GuardBehavior = require('./behaviors/GuardBehavior');

class Behaviors {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = botCore.bot;

        // Access Layer 1
        this.primitives = botCore.primitives;
        // Register Guard Behavior
        this.guard = new GuardBehavior(botCore);

        // Load sub-behaviors
        // this.mining = new MiningBehavior(botCore);
    }

    /**
     * Silent Guardian Protocol wrapper
     */
    async guardian_mode(error, whisper_to) {
        console.log(`[Behaviors] Triggering Guardian Mode: ${error}`);
        if (whisper_to && this.botCore.config.owner) {
            // Ensure owner config is set properly if passed
            // Actually botCore.activateGuardianMode looks at config.owner or env
        }
        await this.botCore.activateGuardianMode(error);
        return { success: true, message: "Guardian Protocol Activated" };
    }

    get bot() { return this.botCore.bot; }
    get mcData() { return this.botCore.mcData; }

    // --- UTILS ---
    async _checkToolFor(block) {
        // Simple check: do we have ANY tool?
        // Real logic would use block.harvestTools
        // For Layer 2: Check if digging is possible/fast enough?
        // "No self optimize" -> We just check if we CAN harvest, if required.
        if (!block.canHarvest(this.bot.heldItem ? this.bot.heldItem.type : null)) {
            // Try to equip best tool
            await this.bot.tool.equipForBlock(block, {});
            if (!block.canHarvest(this.bot.heldItem ? this.bot.heldItem.type : null)) {
                throw new Error(`Cannot harvest ${block.name} with current tool.`);
            }
        }
    }

    // --- ACTIONS (All return { success, message, data? }) ---

    async mine_block(type_name, count = 1) {
        try {
            const blockType = this.mcData.blocksByName[type_name];
            if (!blockType) {
                return { success: false, message: `Unknown block type: ${type_name}` };
            }

            let mined = 0;
            for (let i = 0; i < count; i++) {
                const blocks = await this.bot.findBlocks({ matching: blockType.id, maxDistance: 32, count: 1 });
                if (blocks.length === 0) break;

                const targetPos = blocks[0];
                const block = this.bot.blockAt(targetPos);

                await this._checkToolFor(block);
                await this.primitives.move_to(targetPos);
                await this.primitives.break_block(targetPos);
                mined++;
            }

            if (mined === 0) {
                return { success: false, message: `Block ${type_name} not found nearby.` };
            }
            return { success: true, message: `Mined ${mined} ${type_name}`, data: { mined } };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async craft_item(item_name, count = 1) {
        try {
            const item = this.mcData.itemsByName[item_name];
            if (!item) {
                return { success: false, message: `Unknown item: ${item_name}` };
            }

            const recipes = this.bot.recipesFor(item.id, null, 1, true);
            if (recipes.length === 0) {
                return { success: false, message: `No recipe or resources for ${item_name}` };
            }

            const recipe = recipes[0];
            let craftingTable = null;

            if (recipe.requiresTable) {
                craftingTable = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 32 });
                if (!craftingTable) {
                    return { success: false, message: "Crafting table required but not found." };
                }
                await this.primitives.move_to(craftingTable.position);
            }

            await this.bot.craft(recipe, count, craftingTable);
            return { success: true, message: `Crafted ${count} ${item_name}`, data: { item_name, count } };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

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

                    // Check if empty
                    const existing = this.bot.blockAt(pos);
                    if (existing && existing.name !== 'air') {
                        // console.log(`Skipping ${pos}, not air.`);
                        continue;
                    }

                    // Check item count strict
                    const currentItem = this.bot.inventory.items().find(i => i.name === block_name);
                    if (!currentItem) throw new Error(`Ran out of ${block_name}`);

                    // We need a face to place on. Simplistic approach: place on block below.
                    const below = this.bot.blockAt(pos.offset(0, -1, 0));
                    if (!below || below.name === 'air') {
                        throw new Error(`Cannot place at ${pos}, no support block below.`);
                    }

                    await this.primitives.move_to(pos.offset(2, 0, 0)); // Stand nearby
                    await this.primitives.place_block(currentItem, pos, new Vec3(0, 1, 0)); // Logic in primitives needs update to accept face or we assume logic
                    // Primitive place_block takes (block, position, face).
                    // Ideally we place ON the block below:
                    // this.primitives.place_block_on(below, top_face)

                    // Using raw bot.placeBlock logic from primitive wrapper:
                    // primitive expects (item, targetPos, faceVector)
                    // It tries to place block AT targetPos?
                    // Let's re-read primitive: 
                    // await this.bot.placeBlock(referenceBlock, new Vec3(face.x, face.y, face.z));
                    // So we must pass the reference block (below) and the face (up).

                    await this.primitives.use_item(block_name); // Equip
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

        for (let y = maxY; y >= minY; y--) { // Top down
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



    // --- TIER 2: HUMAN-LIKE BEHAVIORS ---

    async wander_random(radius = 16) {
        const x = this.bot.entity.position.x + (Math.random() * radius * 2 - radius);
        const z = this.bot.entity.position.z + (Math.random() * radius * 2 - radius);
        // Find safe y?
        const y = this.bot.entity.position.y;

        await this.primitives.move_to({ x, y, z });
        await Humanizer.random_delay(1000, 3000); // Stop and look around?
    }

    async human_mine(type_name, count) {
        // Just calls mine_block but with hesitation and breaks
        await Humanizer.hesitate(0.5);
        await this.mine_block(type_name, count);
        await Humanizer.random_delay(500, 1500); // Catch breath
    }

    async human_build(block_name, area) {
        // Slower build with chance of mistake
        await this.build_area(block_name, area);
        // Note: Real "human build" acts inside the loop of build_area. 
        // Ideally we refactor build_area to accept options or subclass it. 
        // For now, this just adds a defined pause after building.
    }

    async stop_and_wait(seconds) {
        await this.primitives.stop();
        await Humanizer.delay(seconds * 1000);
    }

    async place_block_slow(block_name, position, face) {
        // Hesitate before placing
        await Humanizer.hesitate(0.5);

        const item = this.bot.inventory.items().find(i => i.name === block_name);
        if (!item) throw new Error("Item not found");

        await this.primitives.use_item(block_name);
        const targetPos = new Vec3(position.x, position.y, position.z);
        const reference = this.bot.blockAt(targetPos); // Actually we need reference block separate? 
        // Simplified: assume position is the target air block, Place on block BELOW it for now or rely on primitives update
        // Primitives place_block needs update to be robust? 
        // For now, let's just presume we place against the block at 'position'

        await this.primitives.place_block(item, position, face);
    }

    async misplace_block(block_name, intended_position) {
        // Place block at WRONG position nearby
        const offsetX = Math.random() > 0.5 ? 1 : -1;
        const wrongPos = new Vec3(intended_position.x + offsetX, intended_position.y, intended_position.z);

        try {
            await this.place_block_slow(block_name, wrongPos, { x: 0, y: 1, z: 0 });
            return wrongPos;
        } catch (e) { return null; }
    }

    async remove_wrong_block(position) {
        await Humanizer.hesitate(1); // Realize mistake
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

        console.log(`[Behaviors] Bắt đầu san phẳng khu vực từ y=${maxY} xuống y=${targetY}.`);

        const blocksToBreak = [];
        const blocksToPlace = [];

        // Scan phase
        console.log("[Behaviors] Đang quét khu vực để lên kế hoạch...");
        for (let y = maxY; y >= minY; y--) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const pos = new Vec3(x, y, z);
                    const block = this.bot.blockAt(pos);

                    if (!block) continue;

                    if (y > targetY && block.name !== 'air') {
                        blocksToBreak.push(block);
                    } else if (y === targetY && block.name === 'air') {
                        const blockBelow = this.bot.blockAt(pos.offset(0, -1, 0));
                        if (blockBelow && blockBelow.name !== 'air') {
                            blocksToPlace.push(pos);
                        }
                    }
                }
            }
        }

        console.log(`[Behaviors] Quét xong! ${blocksToBreak.length} khối cần đập, ${blocksToPlace.length} vị trí cần lấp.`);

        // Break Phase
        if (blocksToBreak.length > 0) {
            console.log("[Behaviors] Bắt đầu đập các khối thừa...");
            // Sort by Y desc (top to bottom) then distance
            blocksToBreak.sort((a, b) => b.position.y - a.position.y || a.position.distanceTo(this.bot.entity.position) - b.position.distanceTo(this.bot.entity.position));

            for (const targetBlock of blocksToBreak) {
                try {
                    // Update tool if needed
                    await this._checkToolFor(targetBlock);
                    await this.primitives.move_to(targetBlock.position);
                    await this.primitives.break_block(targetBlock.position);
                } catch (err) {
                    console.log(`Lỗi phá block tại ${targetBlock.position}: ${err.message}`);
                }
            }
        }

        // Place Phase
        if (blocksToPlace.length > 0) {
            console.log("[Behaviors] Bắt đầu lấp đầy các lỗ hổng...");
            for (const targetPos of blocksToPlace) {
                const fillerItem = this.bot.inventory.items().find(item => item.name === 'dirt' || item.name === 'cobblestone' || item.name === 'stone');
                if (!fillerItem) throw new Error("Hết vật liệu (đất/đá) để lấp đầy.");

                try {
                    await this.primitives.move_to(targetPos.offset(1, 1, 0)); // Move near
                    const referenceBlock = this.bot.blockAt(targetPos.offset(0, -1, 0));

                    if (referenceBlock) {
                        await this.primitives.place_block(fillerItem, targetPos, new Vec3(0, 1, 0)); // Place on top of reference
                    }
                } catch (err) {
                    console.log(`Lỗi đặt block tại ${targetPos}: ${err.message}`);
                }
            }
        }

        console.log("[Behaviors] Hoàn thành san phẳng.");
    }

    async craft_if_possible(item_name) {
        try {
            await this.craft_item(item_name, 1);
            return true;
        } catch (e) {
            return false;
        }
    }

    // === MIGRATED FROM LEGACY actions/combat.js ===

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
        console.log(`[Behaviors] Attacking ${target_name}!`);
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
        console.log(`[Behaviors] Equipped: ${weapons[0].name}`);
    }

    async equip_best_armor() {
        console.log("[Behaviors] Checking and equipping armor...");
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
        console.log("[Behaviors] Best armor equipped.");
    }

    async equip_best_tool() {
        const allTools = this.bot.inventory.items().filter(item =>
            item.name.endsWith('_pickaxe') ||
            item.name.endsWith('_axe') ||
            item.name.endsWith('_shovel')
        );

        if (allTools.length === 0) {
            console.log("[Behaviors] No tools in inventory.");
            return;
        }

        const bestTool = this._getBestItem(allTools);
        if (bestTool) {
            await this.bot.equip(bestTool, 'hand');
            console.log(`[Behaviors] Equipped best tool: ${bestTool.name}`);
        }
    }

    // === MIGRATED FROM LEGACY actions/interaction.js ===

    async find_and_collect(item_name, quantity = 1) {
        const blockType = this.mcData.blocksByName[item_name];
        if (!blockType) throw new Error(`Unknown block '${item_name}'.`);

        const blocks = await this.bot.findBlocks({
            matching: blockType.id,
            maxDistance: 64,
            count: quantity * 2
        });

        if (blocks.length === 0) throw new Error(`Block '${item_name}' not found nearby.`);

        const targets = blocks.map(p => this.bot.blockAt(p)).slice(0, quantity);
        await this.bot.collectBlock.collect(targets);
    }

    async give_item_to_player(username, item_name, quantity = 1) {
        const target = this.bot.players[username]?.entity;
        if (!target) throw new Error(`Player '${username}' not found.`);

        const item = this.bot.inventory.items().find(i => i.name === item_name);
        if (!item) throw new Error(`No '${item_name}' in inventory.`);
        if (item.count < quantity) throw new Error(`Not enough '${item_name}', only have ${item.count}.`);

        await this.bot.lookAt(target.position.offset(0, 1.6, 0));
        await this.bot.toss(item.type, null, quantity);
        console.log(`[Behaviors] Gave ${quantity} ${item_name} to ${username}.`);
    }

    async eat_until_full() {
        while (this.bot.food < 20) {
            if (!this.bot.canEat()) break;

            const food = this.bot.inventory.items()
                .filter(item => this.mcData.foods[item.type])
                .sort((a, b) => {
                    const foodA = this.mcData.foods[a.type];
                    const foodB = this.mcData.foods[b.type];
                    return (foodB.foodPoints + foodB.saturation) - (foodA.foodPoints + foodA.saturation);
                })[0];

            if (!food) {
                console.log("[Behaviors] No food in inventory.");
                return;
            }

            try {
                await this.bot.equip(food, 'hand');
                await this.bot.consume();
                await new Promise(resolve => setTimeout(resolve, 250));
            } catch (e) {
                throw new Error(`Error while eating: ${e.message}`);
            }
        }
        console.log("[Behaviors] Fully fed!");
    }

    // === MIGRATED FROM LEGACY actions/basic.js ===

    async say_message(message) {
        this.botCore.say(message);
    }

    async stop_actions() {
        this.botCore.taskManager.stopCurrentTask();
        if (this.guard) this.guard.stop();
    }

    async remember_location(name) {
        const pos = this.bot.entity.position;
        if (!name) name = `loc_${Date.now()}`;

        await this.botCore.memory.saveLocation(name, {
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            z: Math.round(pos.z)
        });
        // Update cache
        this.botCore.locationsCache[name] = pos;
        console.log(`[Behaviors] Saved location: ${name}`);
        return { success: true, message: `Saved location ${name}`, data: { name, pos } };
    }

    async fake_afk(seconds = 10) {
        await Humanizer.fake_afk(this.botCore, seconds);
        return { success: true, message: `AFK for ${seconds}s` };
    }

    async look_at_player(name) {
        const player = this.bot.players[name]?.entity;
        if (player) {
            await this.primitives.look_at(player.position.offset(0, 1.6, 0));
            return { success: true, message: `Looked at ${name}` };
        }
        return { success: false, message: `Player ${name} not found` };
    }

    // === ACTION REGISTRY WRAPPERS ===
    // These wrap primitives to ensure action registry can dispatch correctly

    async set_base() {
        try {
            await this.primitives.set_base();
            return { success: true, message: "Base location set" };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async guard_base(params = {}) {
        try {
            const radius = params.radius || 20;
            await this.primitives.guard_base(radius);
            return { success: true, message: `Guard mode activated with radius ${radius}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async stop_guard() {
        if (this.guard) {
            this.guard.stop();
            return { success: true, message: "Guard mode deactivated" };
        }
        return { success: false, message: "Guard not active" };
    }
}

module.exports = Behaviors;
