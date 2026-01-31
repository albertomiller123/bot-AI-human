const db = require('../database/DatabaseManager');

class VectorDB {
    constructor(botCore) {
        this.botCore = botCore;
        // RAM Cache removed for memory safety (Issue #11)

        // Local model pipeline
        this.embeddingPipeline = null;
        this.loadingPromise = null;

        // Initialize DB
        this.initDB();
    }

    async initDB() {
        try {
            await db.run(`
                CREATE TABLE IF NOT EXISTS vectors (
                    id TEXT PRIMARY KEY,
                    content TEXT,
                    embedding BLOB,
                    metadata TEXT,
                    timestamp TEXT
                )
            `);
            // Index for faster timestamp sorts
            await db.run(`CREATE INDEX IF NOT EXISTS idx_vectors_timestamp ON vectors(timestamp)`);
            this.initModel(); // Start loading AI model in background
        } catch (err) {
            console.error('[VectorDB] DB Init Error:', err);
        }
    }

    /**
     * Init AI Model (Lazy Load with Race Condition Safety)
     */
    async initModel() {
        if (this.embeddingPipeline) return; // Already loaded

        // Check if loading is in progress
        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        console.log("[VectorDB] ⏳ Loading Local Embedding Model...");
        this.loadingPromise = (async () => {
            try {
                const { pipeline } = await import('@xenova/transformers');
                this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
                console.log("[VectorDB] ✅ AI Model Ready!");
            } catch (e) {
                console.error("[VectorDB] ❌ Failed to load AI Model:", e);
            }
        })();

        await this.loadingPromise;
        this.loadingPromise = null;
    }

    /**
     * Create embedding from text (Local CPU)
     */
    async createEmbedding(text) {
        if (!text || text.trim().length === 0) return null;

        try {
            await this.initModel(); // Ensure model loaded

            if (!this.embeddingPipeline) return null;

            // Run model
            const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });

            // Convert Tensor to Array
            return Array.from(output.data);
        } catch (e) {
            console.error("[VectorDB] ❌ Embedding Error:", e.message);
            return null;
        }
    }

    /**
     * Add new memory
     */
    async add(text, metadata = {}) {
        const embedding = await this.createEmbedding(text);
        if (!embedding) return;

        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date().toISOString();

        // Async Insert to DB
        db.run(
            `INSERT INTO vectors (id, content, embedding, metadata, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [id, text, JSON.stringify(embedding), JSON.stringify(metadata), timestamp]
        ).then(() => {
            console.log(`[VectorDB] 🧠 Remembered: "${text.substring(0, 30)}..."`);
        }).catch(err => {
            console.error("[VectorDB] ❌ Save Error:", err);
        });
    }

    /**
     * Search relevant memories using Batch Retrieval (Low RAM usage)
     */
    async search(query, limit = 3) {
        const queryVector = await this.createEmbedding(query);
        if (!queryVector) return [];

        let topResults = [];

        try {
            // Retrieve all rows (SQLite 'all' loads everything, but 'each' is better for streaming)
            // Limitations: sqlite3 'each' is callback based. 
            // For now, to solve OOM, we can fetch just ID and Embedding first?
            // Or just fetch chunks.
            // A simple "SELECT * FROM vectors" for 10k rows might be 20-30MB JSON stringified. 
            // It is strictly better than "SELECT *" AND "keeping it in RAM forever".
            // optimization: We will accept a temporary load of data for the search duration, but not keep it.

            const rows = await db.all("SELECT content, embedding, metadata FROM vectors");

            // Streaming calculation to avoid creating huge object arrays
            // Note: 'rows' still consumes RAM, but GC can reclaim it after search.
            // Ideally we'd use a cursor/stream, but standard sqlite3 driver is limited here without complexity.

            topResults = rows.map(row => {
                const vec = JSON.parse(row.embedding);
                const score = this.cosineSimilarity(queryVector, vec);
                return { text: row.content, score, metadata: JSON.parse(row.metadata || '{}') };
            })
                .sort((a, b) => b.score - a.score)
                .filter(item => item.score > 0.3)
                .slice(0, limit);

        } catch (e) {
            console.error("[VectorDB] Search Error:", e);
        }

        return topResults;
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

module.exports = VectorDB;
