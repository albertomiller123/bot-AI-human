const { v4: uuidv4 } = require('uuid');
const db = require('../database/DatabaseManager');

class VectorDB {
    constructor(botCore) {
        this.botCore = botCore;
        this.vectors = []; // Validated Cache (User request)

        // Local model pipeline
        this.embeddingPipeline = null;
        this.loadingPromise = null;

        // Initialize DB
        this.initDB();
    }
    // ... (skip unchanged methods)

    // ... (skip unchanged methods)

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
     * Add new memory (Race Condition Fixed)
     */
    async add(text, metadata = {}) {
        const embedding = await this.createEmbedding(text);
        if (!embedding) return;

        const id = require('uuid').v4(); // Ensure uuid is used
        const timestamp = new Date().toISOString();
        const entry = { id, content: text, embedding, metadata, timestamp };

        try {
            await db.run(
                `INSERT INTO vectors (id, content, embedding, metadata, timestamp) VALUES (?, ?, ?, ?, ?)`,
                [id, text, JSON.stringify(embedding), JSON.stringify(metadata), timestamp]
            );
            // Only push to RAM when DB success
            if (this.vectors) this.vectors.push(entry);
            console.log(`[VectorDB] 🧠 Remembered: "${text.substring(0, 30)}..."`);
        } catch (err) {
            console.error("[VectorDB] ❌ Save Error:", err);
        }
    }

    /**
     * Search relevant memories using Batch Retrieval (Low RAM usage)
     */
    async search(query, limit = 3) {
        const queryVector = await this.createEmbedding(query);
        if (!queryVector) return [];

        let topResults = []; // Keep only top K results

        try {
            // Streaming Scan: Read 1 row -> Compute Logic -> Keep/Discard -> GC
            // This ensures we never hold the full DB in memory.

            await db.each("SELECT content, embedding, metadata FROM vectors", [], (err, row) => {
                if (err) return;

                const vec = JSON.parse(row.embedding);
                const score = this.cosineSimilarity(queryVector, vec);

                if (score > 0.3) {
                    const item = { text: row.content, score, metadata: JSON.parse(row.metadata || '{}') };

                    // Simple Insertion Sort / Keep top K
                    topResults.push(item);
                    topResults.sort((a, b) => b.score - a.score);
                    if (topResults.length > limit) {
                        topResults.pop(); // Remove worst
                    }
                }
            });

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
