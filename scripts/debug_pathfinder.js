try {
    const pf = require('mineflayer-pathfinder');
    console.log("Exports keys:", Object.keys(pf));
    if (pf.goals) {
        console.log("goals exists");
        console.log("GoalNear:", pf.goals.GoalNear ? "exists" : "missing");
    } else {
        console.log("❌ goals is MISSING");
    }
} catch (e) {
    console.log("Error:", e.message);
}
