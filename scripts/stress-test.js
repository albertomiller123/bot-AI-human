const axios = require('axios');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TOKEN = 'admin-secure-token-2026'; // Match .env
const TOTAL_REQUESTS = 100;
const CONCURRENCY = 20;

async function runStressTest() {
    console.log(`[StressTest] Starting stress test against ${BASE_URL}`);
    console.log(`[StressTest] Target: ${TOTAL_REQUESTS} requests with ${CONCURRENCY} concurrency`);

    const results = {
        success: 0,
        failed: 0,
        avgTime: 0
    };

    const start = Date.now();
    const promises = [];

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        promises.push(makeRequest(i));
        // Simple throttling for concurrency simulation
        if (promises.length >= CONCURRENCY) {
            await Promise.race(promises);
        }
    }

    await Promise.allSettled(promises);
    const end = Date.now();

    console.log('\n--- Test Results ---');
    console.log(`Total Time: ${(end - start) / 1000}s`);
    console.log(`Success: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
}

async function makeRequest(id) {
    const payloads = [
        { type: 'status', method: 'GET', url: '/status' },
        { type: 'chat', method: 'POST', url: '/chat', data: { message: `Stress test message ${id}` } },
        { type: 'command', method: 'POST', url: '/command', data: { command: 'jump' } },
        { type: 'bad_token', method: 'GET', url: '/status', token: 'invalid' } // Should fail 403
    ];

    const scenario = payloads[id % payloads.length];
    const url = `${BASE_URL}${scenario.url}`;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (scenario.token !== 'invalid') {
            headers['Authorization'] = `Bearer ${TOKEN}`;
        }

        const res = await axios({
            method: scenario.method,
            url: url,
            headers: headers,
            data: scenario.data,
            params: scenario.method === 'GET' ? { token: scenario.token !== 'invalid' ? TOKEN : 'bad' } : {},
            timeout: 5000
        });

        if (res.status === 200) {
            // console.log(`[${id}] ✅ Success (${scenario.type})`);
        }
    } catch (e) {
        if (scenario.type === 'bad_token' && e.response && e.response.status === 403) {
            // console.log(`[${id}] ✅ Expected 403 (Security Check)`);
        } else {
            console.error(`[${id}] ❌ Failed: ${e.message}`);
        }
    }
}

// Check if axios is installed, if not, use simple http
try {
    require('axios');
    runStressTest();
} catch (e) {
    console.error("Please install axios to run this test: npm install axios");
}
