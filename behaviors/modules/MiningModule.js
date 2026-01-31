const Humanizer = require('../../humanizer');

class MiningModule {
    constructor(botCore) {
        this.botCore = botCore;
    }

    get bot() { return this.botCore.bot; }
    get mcData() { return this.botCore.mcData; }
    get primitives() { return this.botCore.primitives; }

    async _checkToolFor(block) {
        // Simple check: do we have ANY tool?
        if (!block.canHarvest(this.bot.heldItem ? this.bot.heldItem.type : null)) {
            // Try to equip best tool
            await this.bot.tool.equipForBlock(block, {});
            if (!block.canHarvest(this.bot.heldItem ? this.bot.heldItem.type : null)) {
                throw new Error(`Cannot harvest ${block.name} with current tool.`);
            }
        }
    }

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

    async human_mine(type_name, count) {
        // Just calls mine_block but with hesitation and breaks
        await Humanizer.hesitate(0.5);
        await this.mine_block(type_name, count);
        await Humanizer.random_delay(500, 1500); // Catch breath
    }
}

module.exports = MiningModule;
