/**
 * tests/stealth_test.js
 * Offline Simulation to verify Stealth Agent Modules
 */

const SocialGraph = require('../core/social/SocialGraph');
const SocialFilter = require('../core/social/SocialFilter');
const LieLedger = require('../core/social/LieLedger');

// Mock Config
process.env.OWNER_LIST = 'AdminOwner';
process.env.TRUSTED_LIST = 'Friend1,Friend2';

async function runTest() {
    console.log("🧩 Starting Stealth Agent Integration Test...\n");

    // 1. Setup Modules
    const ledger = new LieLedger();
    const graph = new SocialGraph();
    const filter = new SocialFilter(graph);

    filter.setBotName('AntigravityBot');

    // 2. Test Cases
    const scenarios = [
        { user: 'AdminOwner', msg: 'come here', expected: 'execute', desc: 'Owner Command' },
        { user: 'AdminOwner', msg: 'hello', expected: 'execute', desc: 'Owner Chat' }, // All owner msgs allow execute/reply
        { user: 'Stranger1', msg: 'hello world', expected: 'ignore', desc: 'Public Noise' },
        { user: 'Stranger1', msg: 'AntigravityBot where r u', expected: 'reply', desc: 'Direct Mention' },
        { user: 'Stranger1', msg: 'cho t it go', isWhisper: true, expected: 'deflect', desc: 'Begging (Whisper)' },
        { user: 'Friend1', msg: 'hi', expected: 'reply', desc: 'Trusted Friend' }
    ];

    let passed = 0;

    for (const s of scenarios) {
        process.stdout.write(`Testing: [${s.user}] "${s.msg}"... `);

        // Mock Whisper logic normally handled inside ChatEngine logic call to `decide`
        // We pass isWhisper explicitly to decide()
        const isWhisper = s.isWhisper || false;

        const decision = filter.decide(s.user, s.msg, isWhisper);

        if (decision.action === s.expected) {
            console.log(`✅ PASS (${decision.action})`);
            passed++;
        } else {
            console.log(`❌ FAIL (Expected: ${s.expected}, Got: ${decision.action})`);
        }
    }

    // 3. Lie Ledger Test
    console.log("\nTesting Lie Ledger...");
    ledger.addFact('TestUser', 'I am a bot');
    const facts = ledger.getFacts('TestUser');
    if (facts.some(f => f.text === 'I am a bot')) {
        console.log("✅ PASS: Fact saved.");
        passed++;
    } else {
        console.log("❌ FAIL: Fact not saved.");
    }

    console.log(`\nResults: ${passed}/${scenarios.length + 1} passed.`);
}

runTest();
