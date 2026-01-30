/**
 * action-registry.js - Central Action API Schema Registry
 * 
 * Defines JSON Schema for all available bot actions.
 * Used for LLM Function Calling and validation.
 */

const ACTION_SCHEMAS = {
    // === MINING & GATHERING ===
    mine_block: {
        name: "mine_block",
        description: "Mine/dig blocks of a specified type",
        parameters: {
            type: "object",
            properties: {
                type_name: { type: "string", description: "Block type to mine (e.g., 'oak_log', 'stone', 'iron_ore')" },
                count: { type: "integer", description: "Number of blocks to mine", default: 1 }
            },
            required: ["type_name"]
        }
    },

    find_and_collect: {
        name: "find_and_collect",
        description: "Find and collect blocks/items from the world",
        parameters: {
            type: "object",
            properties: {
                item_name: { type: "string", description: "Item/block name to collect" },
                quantity: { type: "integer", description: "Amount to collect", default: 1 }
            },
            required: ["item_name"]
        }
    },

    // === CRAFTING ===
    craft_item: {
        name: "craft_item",
        description: "Craft an item using available recipes",
        parameters: {
            type: "object",
            properties: {
                item_name: { type: "string", description: "Item to craft (e.g., 'crafting_table', 'wooden_pickaxe')" },
                count: { type: "integer", description: "Number to craft", default: 1 }
            },
            required: ["item_name"]
        }
    },

    // === BUILDING ===
    build_area: {
        name: "build_area",
        description: "Fill an area with blocks",
        parameters: {
            type: "object",
            properties: {
                block_name: { type: "string", description: "Block type to place" },
                area: {
                    type: "object",
                    properties: {
                        min: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } } },
                        max: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } } }
                    },
                    required: ["min", "max"]
                }
            },
            required: ["block_name", "area"]
        }
    },

    clear_area: {
        name: "clear_area",
        description: "Clear all blocks in an area (dig)",
        parameters: {
            type: "object",
            properties: {
                area: {
                    type: "object",
                    properties: {
                        min: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } } },
                        max: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } } }
                    },
                    required: ["min", "max"]
                }
            },
            required: ["area"]
        }
    },

    flatten_area: {
        name: "flatten_area",
        description: "Flatten an area (dig high blocks, fill low blocks)",
        parameters: {
            type: "object",
            properties: {
                corner1: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } } },
                corner2: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } } }
            },
            required: ["corner1", "corner2"]
        }
    },

    // === NAVIGATION ===
    pathfind_to: {
        name: "pathfind_to",
        description: "Navigate to a specific position",
        parameters: {
            type: "object",
            properties: {
                position: {
                    type: "object",
                    properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } },
                    required: ["x", "y", "z"]
                }
            },
            required: ["position"]
        }
    },

    follow_player: {
        name: "follow_player",
        description: "Follow a player continuously",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Player username to follow" }
            },
            required: ["name"]
        }
    },

    wander_random: {
        name: "wander_random",
        description: "Wander randomly within radius",
        parameters: {
            type: "object",
            properties: {
                radius: { type: "integer", description: "Max distance to wander", default: 16 }
            }
        }
    },

    // === COMBAT ===
    attack_target: {
        name: "attack_target",
        description: "Attack a nearby entity (player or mob)",
        parameters: {
            type: "object",
            properties: {
                target_name: { type: "string", description: "Name of entity to attack" }
            },
            required: ["target_name"]
        }
    },

    equip_best_weapon: {
        name: "equip_best_weapon",
        description: "Equip the best available weapon",
        parameters: { type: "object", properties: {} }
    },

    equip_best_armor: {
        name: "equip_best_armor",
        description: "Equip the best available armor",
        parameters: { type: "object", properties: {} }
    },

    equip_best_tool: {
        name: "equip_best_tool",
        description: "Equip the best available tool",
        parameters: { type: "object", properties: {} }
    },

    // === SURVIVAL ===
    eat_food: {
        name: "eat_food",
        description: "Eat food from inventory",
        parameters: { type: "object", properties: {} }
    },

    eat_until_full: {
        name: "eat_until_full",
        description: "Keep eating until fully fed (hunger bar = 20)",
        parameters: { type: "object", properties: {} }
    },

    // === INTERACTION ===
    give_item_to_player: {
        name: "give_item_to_player",
        description: "Toss item to a nearby player",
        parameters: {
            type: "object",
            properties: {
                username: { type: "string", description: "Player to give item to" },
                item_name: { type: "string", description: "Item to give" },
                quantity: { type: "integer", description: "Amount to give", default: 1 }
            },
            required: ["username", "item_name"]
        }
    },

    say_message: {
        name: "say_message",
        description: "Send a chat message",
        parameters: {
            type: "object",
            properties: {
                message: { type: "string", description: "Message to send" }
            },
            required: ["message"]
        }
    },

    // === CONTROL ===
    stop_actions: {
        name: "stop_actions",
        description: "Stop all current actions",
        parameters: { type: "object", properties: {} }
    },

    // === UTILITY ===
    remember_location: {
        name: "remember_location",
        description: "Save current location to memory with a name",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Name for the location" }
            },
            required: ["name"]
        }
    },

    fake_afk: {
        name: "fake_afk",
        description: "Pretend to be AFK for a while",
        parameters: {
            type: "object",
            properties: {
                seconds: { type: "integer", description: "Duration in seconds", default: 10 }
            },
            required: []
        }
    },

    // === DEFENSE ===
    set_base: {
        name: "set_base",
        description: "Set the current location as the 'Base' to defend",
        parameters: { type: "object", properties: {} }
    },

    guard_base: {
        name: "guard_base",
        description: "Start guarding the base (combat mode)",
        parameters: {
            type: "object",
            properties: {
                radius: { type: "integer", description: "Patrol radius", default: 20 }
            }
        }
    },

    // === PROTOCOLS ===
    guardian_mode: {
        name: "guardian_mode",
        description: "Activate Silent Guardian Protocol (Defense Mode + Report)",
        parameters: {
            type: "object",
            properties: {
                error: { type: "string", description: "Error message/reason" },
                whisper_to: { type: "string", description: "Owner username to report to" }
            },
            required: ["error"]
        }
    }
};

/**
 * Get all action schemas in OpenAI function calling format
 */
function getToolsForLLM() {
    return Object.values(ACTION_SCHEMAS).map(schema => ({
        type: "function",
        function: {
            name: schema.name,
            description: schema.description,
            parameters: schema.parameters
        }
    }));
}

/**
 * Get schema for a specific action
 */
function getActionSchema(actionName) {
    return ACTION_SCHEMAS[actionName] || null;
}

/**
 * Validate action call against schema
 */
function validateActionCall(actionName, params) {
    const schema = ACTION_SCHEMAS[actionName];
    if (!schema) {
        return { valid: false, error: `Unknown action: ${actionName}` };
    }

    const required = schema.parameters.required || [];
    for (const field of required) {
        if (params[field] === undefined) {
            return { valid: false, error: `Missing required parameter: ${field}` };
        }
    }

    return { valid: true };
}

/**
 * Get list of all available action names
 */
function getAvailableActions() {
    return Object.keys(ACTION_SCHEMAS);
}

module.exports = {
    ACTION_SCHEMAS,
    getToolsForLLM,
    getActionSchema,
    validateActionCall,
    getAvailableActions
};
