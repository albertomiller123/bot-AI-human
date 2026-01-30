const WebServer = require('../web-server');
const http = require('http');

console.log("🧪 Starting Web Dashboard Verification...");

// 1. Mock BotCore
const mockBotCore = {
    bot: {
        username: "TestBot",
        health: 20,
        food: 20,
        entity: { position: { x: 0, y: 60, z: 0 } }
    },
    memory: {
        getRecentChats: async () => [{ sender: "User", message: "Hello", timestamp: Date.now() }],
        logChat: () => { }
    },
    taskManager: {
        activeTask: { complex_task: "Testing" }
    },
    config: {
        owner: { name: "Tester" },
        reflex: {}
    }
};

// 2. Initialize Server
const PORT = 3005; // Use a distinct port
const server = new WebServer(mockBotCore, PORT);

// Suppress console logs specifically for the server start to keep output clean
const originalLog = console.log;
// console.log = () => {}; 

try {
    server.start();
    // Allow server to bind
    setTimeout(runTests, 1000);
} catch (e) {
    console.error("❌ Failed to start server:", e);
    process.exit(1);
}

function runTests() {
    console.log = originalLog;
    console.log(`✅ Server started on port ${PORT}`);

    // Test 1: GET /api/status
    const statusRequest = http.get(`http://localhost:${PORT}/api/status`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'online' && json.username === 'TestBot') {
                        console.log("✅ Test [GET /api/status]: PASS");
                    } else {
                        console.error("❌ Test [GET /api/status]: FAIL (Invalid Data)", json);
                    }
                } catch (e) {
                    console.error("❌ Test [GET /api/status]: FAIL (Invalid JSON)", data);
                }
            } else {
                console.error(`❌ Test [GET /api/status]: FAIL (Status ${res.statusCode})`);
            }
            checkDashboard();
        });
    });
    statusRequest.on('error', (e) => console.error("❌ Test [GET /api/status]: ERROR", e.message));
}

function checkDashboard() {
    // Test 2: GET / (Dashboard HTML)
    const pageRequest = http.get(`http://localhost:${PORT}/`, (res) => {
        if (res.statusCode === 200) {
            console.log("✅ Test [GET / (Dashboard)]: PASS");
            checkWorker();
        } else {
            console.error(`❌ Test [GET / (Dashboard)]: FAIL (Status ${res.statusCode})`);
            process.exit(1);
        }
    });
}

function checkWorker() {
    // Test 3: Static Load of AIWorker (Syntax check)
    try {
        require('../core/AIWorker');
        console.log("✅ Test [AIWorker Logic]: PASS (Syntax/Load Check)");
    } catch (e) {
        console.error("❌ Test [AIWorker Logic]: FAIL (Syntax Error)", e.message);
    }

    console.log("\n🎉 All Verification Checks Complete!");
    process.exit(0);
}
