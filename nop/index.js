require('dotenv').config();
const fs = require('fs');
const BotCore = require('./bot-core');

// Check MegaLLM API Key
const apiKey = process.env.MEGALLM_API_KEY;
if (!apiKey) {
    console.warn("CẢNH BÁO: MEGALLM_API_KEY chưa được thiết lập. AI sẽ không hoạt động.");
} else {
    console.log(`[System] API Key loaded: ${apiKey.substring(0, 10)}... (Length: ${apiKey.length})`);
}

// Load Config
let config;
try {
    const configFile = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(configFile);
    console.log("Tải cấu hình thành công.");
} catch (error) {
    console.error("Lỗi: Không thể đọc file config.json!", error);
    process.exit(1);
}

// Start Bot
try {
    const botInstance = new BotCore(config);
    botInstance.start();
    console.log("Hệ thống khởi động hoàn tất. Chờ kết nối...");
} catch (e) {
    console.error("Lỗi không xác định khi khởi tạo bot:", e);
}