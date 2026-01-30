require('dotenv').config();
const fs = require('fs');
const BotCore = require('./bot-core');

// ===================================
// GLOBAL ERROR HANDLERS
// ===================================
process.on('unhandledRejection', (reason, promise) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] [Fatal] Unhandled Rejection at: ${promise}\nReason: ${reason}\n\n`;

    console.error(logMsg);
    try {
        fs.appendFileSync('error.log', logMsg);
    } catch (e) {
        // Ignore write error
    }
    // Don't exit - try to keep running
});

process.on('uncaughtException', (error) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] [Fatal] Uncaught Exception: ${error.message}\nStack: ${error.stack}\n\n`;

    console.error(logMsg);
    try {
        fs.appendFileSync('error.log', logMsg);
    } catch (e) {
        console.error("Failed to write to error.log:", e);
    }

    // Recoverable errors - don't crash
    const recoverableErrors = [
        'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE',  // Network errors
        'ENOTFOUND', 'EAI_AGAIN',  // DNS errors
        'read ECONNRESET'  // Socket errors
    ];

    const isRecoverable = recoverableErrors.some(errType =>
        error.message?.includes(errType) || (error.code && error.code === errType)
    );

    if (isRecoverable) {
        console.warn('[System] Recoverable error detected, continuing...');
        return; // Don't exit
    }

    // For critical errors, wait 5s then exit (allows reading logs if manual run)
    console.error("[System] Critical Error - Exiting in 5s...");
    setTimeout(() => process.exit(1), 5000);
});

// Graceful shutdown
let botInstance = null;
process.on('SIGINT', async () => {
    console.log('\n[System] Received SIGINT, shutting down gracefully...');
    if (botInstance && botInstance.bot) {
        try {
            botInstance.bot.quit();
        } catch (e) {
            // Ignore
        }
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[System] Received SIGTERM, shutting down...');
    if (botInstance && botInstance.bot) {
        try {
            botInstance.bot.quit();
        } catch (e) {
            // Ignore
        }
    }
    process.exit(0);
});

// ===================================
// MAIN STARTUP
// ===================================

// Check MegaLLM API Key
const apiKey = process.env.MEGALLM_API_KEY;
if (!apiKey) {
    console.warn("⚠️ WARNING: MEGALLM_API_KEY not set. AI features DISABLED.");
} else {
    console.log(`[System] API Key loaded: ${apiKey.substring(0, 10)}... (Length: ${apiKey.length})`);
}

// Show AI config from env
if (process.env.AI_BASE_URL) {
    console.log(`[System] AI Base URL: ${process.env.AI_BASE_URL}`);
}

// Load Config
let config;
try {
    const configFile = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(configFile);
    console.log("✅ Config loaded successfully.");
} catch (error) {
    console.error("❌ Error: Cannot read config.json! Using DEFAULT fallback.", error.message);
    // Minimal fallback to allow start (will likely fail auth, but won't crash process immediately)
    config = {
        bot: {
            auth: "offline",
            username: "FallbackBot",
            host: "localhost",
            port: 5000,
            version: "1.21.1"
        },
        owner: { name: "thinhdzs1vn" },
        settings: {},
        ai: {}
    };
    // Don't exit, try to run
}

// Start Bot
try {
    console.log("Creating BotCore...");
    botInstance = new BotCore(config);
    console.log("BotCore created. Starting...");
    botInstance.start();
    console.log("🚀 System initialized. Waiting for connection...");
} catch (e) {
    console.error("❌ Critical error during bot initialization:", e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
}