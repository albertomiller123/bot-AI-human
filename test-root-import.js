try {
    console.log("Require mineflayer from root...");
    const mf = require('mineflayer');
    console.log("Mineflayer ok");

    console.log("Require bot-core...");
    const core = require('./bot-core');
    console.log("BotCore module loaded");
} catch (e) {
    console.error("FAIL:", e);
}
