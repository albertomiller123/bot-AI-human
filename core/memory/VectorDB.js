const sqlite3 = require('sqlite3').verbose();

class VectorDB {
    constructor(memoryManager, aiManager) {
        this.memory = memoryManager;
        this.ai = aiManager;
        this.tableName = 'memory_vectors';
    }

    async init() {
        // Ensure table exists
        await this.memory._runWithRetry(`
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT,
                embedding TEXT, -- JSON string of float array
                metadata TEXT,  -- JSON object
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("[VectorDB] Initialized vector table.");
    }

    async add(text, metadata = {}) {
        if (!text || !text.trim()) return;

        try {
            const embedding = await this.ai.embed(text);
            if (!embedding) throw new Error("Failed to generate embedding");

            await this.memory._runWithRetry(
                `INSERT INTO ${this.tableName} (text, embedding, metadata) VALUES (?, ?, ?)`,
                [text, JSON.stringify(embedding), JSON.stringify(metadata)]
            );
            console.log(`[VectorDB] Added memory: "${text.substring(0, 30)}..."`);
        } catch (e) {
            console.error(`[VectorDB] Add failed: ${e.message}`);
        }
    }

    async search(query, limit = 5) {
        try {
            const queryEmbedding = await this.ai.embed(query);
            if (!queryEmbedding) return [];

            // Fetch all embeddings (Naive scan, fine for small scale < 5000)
            const rows = await this.memory._allWithRetry(`SELECT id, text, embedding, metadata, timestamp FROM ${this.tableName}`);

            const results = rows.map(row => {
                const vec = JSON.parse(row.embedding);
                const score = this._cosineSimilarity(queryEmbedding, vec);
                return {
                    text: row.text,
                    metadata: JSON.parse(row.metadata || '{}'),
                    score: score,
                    timestamp: row.timestamp
                };
            });

            // Sort by score desc and take top K
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

        } catch (e) {
            console.error(`[VectorDB] Search failed: ${e.message}`);
            return [];
        }
    }

    _cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

module.exports = VectorDB;
