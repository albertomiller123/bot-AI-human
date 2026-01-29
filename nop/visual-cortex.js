/**
 * visual-cortex.js - Vision System for Bot
 * 
 * Captures POV screenshots for LLM visual analysis using prismarine-viewer.
 */

const mineflayerViewer = require('prismarine-viewer').mineflayer;

class VisualCortex {
    constructor(botCore) {
        this.botCore = botCore;
        this.bot = null;
        this.viewer = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the viewer (call after bot spawns)
     */
    async init() {
        if (this.isInitialized) return;

        // Check config
        const config = this.botCore.config.plugins?.vision;
        if (config && config.enabled === false) {
            console.log('[VisualCortex] Vision disabled in config.');
            return;
        }

        this.bot = this.botCore.bot;

        // Check if port 3008 is in use
        const port = 3008;
        const isPortTaken = await this._isPortTaken(port);

        if (isPortTaken) {
            console.warn(`[VisualCortex] ⚠️ Port ${port} is busy. Vision system skipped to prevent crash.`);
            console.warn(`[VisualCortex] Run 'netstat -ano | findstr :${port}' to find the locking process.`);
            return;
        }

        // prismarine-viewer headless mode for buffer capture
        try {
            // Start viewer in headless mode (no browser display)
            this.viewer = mineflayerViewer(this.bot, {
                port: port, // Different from web server port
                firstPerson: true,
                viewDistance: 6
            });

            this.isInitialized = true;
            console.log(`[VisualCortex] Vision system initialized on port ${port}`);
        } catch (error) {
            console.error('[VisualCortex] Failed to initialize:', error.message);
            this.isInitialized = false;
        }
    }

    _isPortTaken(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const tester = net.createServer()
                .once('error', err => resolve(err.code === 'EADDRINUSE'))
                .once('listening', () => tester.close(() => resolve(false)))
                .listen(port);
        });
    }

    /**
     * Capture current POV as Base64 image
     * Note: prismarine-viewer doesn't have direct buffer capture built-in.
     * We'll use an alternative approach with Puppeteer or return server URL.
     */
    async captureScreenshot() {
        if (!this.isInitialized) {
            return {
                success: false,
                message: 'Vision system not initialized',
                data: null
            };
        }

        try {
            // For now, return the viewer URL that LLM can reference
            // In production, you'd use Puppeteer to screenshot localhost:3008
            const viewerUrl = `http://localhost:3008`;

            return {
                success: true,
                message: 'Vision available',
                data: {
                    type: 'viewer_url',
                    url: viewerUrl,
                    timestamp: Date.now()
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }

    /**
     * Get visual context for LLM (text description + optional image)
     */
    getVisualContext() {
        if (!this.bot || !this.bot.entity) {
            return { description: 'Bot not spawned yet', hasVision: false };
        }

        const pos = this.bot.entity.position;
        const yaw = this.bot.entity.yaw;
        const pitch = this.bot.entity.pitch;

        // Get what bot is looking at
        const blockAtCursor = this.bot.blockAtCursor(5);
        const entityAtCursor = this.bot.entityAtCursor(5);

        // Get nearby notable blocks
        const nearbyBlocks = this._scanNearbyNotableBlocks();

        return {
            description: this._generateSceneDescription(blockAtCursor, entityAtCursor, nearbyBlocks),
            hasVision: this.isInitialized,
            viewerUrl: this.isInitialized ? 'http://localhost:3008' : null,
            camera: {
                position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
                yaw: Math.round(yaw * 180 / Math.PI),
                pitch: Math.round(pitch * 180 / Math.PI)
            },
            lookingAt: {
                block: blockAtCursor ? blockAtCursor.name : null,
                entity: entityAtCursor ? (entityAtCursor.username || entityAtCursor.name) : null
            }
        };
    }

    /**
     * Generate text description of current scene
     */
    _generateSceneDescription(blockAtCursor, entityAtCursor, nearbyBlocks) {
        const parts = [];

        // What's in front
        if (entityAtCursor) {
            const name = entityAtCursor.username || entityAtCursor.name || 'unknown entity';
            parts.push(`Looking at: ${name}`);
        } else if (blockAtCursor) {
            parts.push(`Looking at: ${blockAtCursor.name}`);
        } else {
            parts.push('Looking at: open sky/distance');
        }

        // Nearby environment
        if (nearbyBlocks.length > 0) {
            const blockSummary = nearbyBlocks.slice(0, 5).map(b => b.name).join(', ');
            parts.push(`Nearby: ${blockSummary}`);
        }

        // Time of day
        const isDay = this.bot.time.isDay;
        parts.push(`Time: ${isDay ? 'Day' : 'Night'}`);

        // Weather (if raining)
        if (this.bot.isRaining) {
            parts.push('Weather: Raining');
        }

        return parts.join(' | ');
    }

    /**
     * Scan for notable blocks nearby (chests, crafting tables, furnaces, etc.)
     */
    _scanNearbyNotableBlocks() {
        const notableTypes = [
            'chest', 'crafting_table', 'furnace', 'blast_furnace', 'smoker',
            'anvil', 'enchanting_table', 'brewing_stand', 'bed', 'door'
        ];

        const found = [];
        const mcData = this.botCore.mcData;

        for (const typeName of notableTypes) {
            const blockType = mcData.blocksByName[typeName];
            if (!blockType) continue;

            const blocks = this.bot.findBlocks({
                matching: blockType.id,
                maxDistance: 16,
                count: 3
            });

            for (const pos of blocks) {
                found.push({
                    name: typeName,
                    position: pos
                });
            }
        }

        return found;
    }

    /**
     * Close viewer
     */
    close() {
        if (this.viewer) {
            try {
                this.viewer.close();
            } catch (e) {
                // Ignore close errors
            }
            this.isInitialized = false;
        }
    }
}

module.exports = VisualCortex;
