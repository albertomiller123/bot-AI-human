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

            // HYBRID CACHE: Load Embeddings + Metadata into RAM (No Content)
            console.log("[VectorDB] ⏳ Hydrating Memory Index (IDs & Embeddings only)...");
            // ONE-TIME FIX: Must load 'embedding' to calculate similarity
            const rows = await db.all("SELECT id, embedding, metadata FROM vectors");

            this.vectors = rows.map(row => {
                let parsedEmbedding;
                try {
                    parsedEmbedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
                } catch (e) {
                    parsedEmbedding = [];
                }

                return {
                    id: row.id,
                    embedding: parsedEmbedding,
                    metadata: JSON.parse(row.metadata || '{}')
                };
            });
            console.log(`[VectorDB] ✅ Memory Index Ready: ${this.vectors.length} items loaded.`);

            this.initModel(); // Start loading AI model in background
        } catch (err) {
            console.error('[VectorDB] DB Init Error:', err);
        }
    }

    /**
     * Add new memory (Race Condition Fixed + Hybrid Cache)
     */
    async add(text, metadata = {}) {
        const embedding = await this.createEmbedding(text);
        if (!embedding) return;

        const id = require('uuid').v4();
        const timestamp = new Date().toISOString();

        // RAM Entry: No Content
        const indexEntry = { id, embedding, metadata };

        try {
            await db.run(
                `INSERT INTO vectors (id, content, embedding, metadata, timestamp) VALUES (?, ?, ?, ?, ?)`,
                [id, text, JSON.stringify(embedding), JSON.stringify(metadata), timestamp]
            );
            // Only push Index to RAM
            this.vectors.push(indexEntry);
            console.log(`[VectorDB] 🧠 Remembered: "${text.substring(0, 30)}..."`);
        } catch (err) {
            console.error("[VectorDB] ❌ Save Error:", err);
        }
    }

    /**
     * Search relevant memories using Hybrid Search (RAM Vector Scan -> Disk Content Fetch)
     */
    async search(query, limit = 3) {
        const queryVector = await this.createEmbedding(query);
        if (!queryVector) return [];

        try {
            // 1. In-Memory Vector Scan (Fast)
            const scores = this.vectors.map(vec => ({
                id: vec.id,
                score: this.cosineSimilarity(queryVector, vec.embedding),
                metadata: vec.metadata
            }));

            // 2. Sort and Top K
            // Filter low relevance first (> 0.3)
            const topResults = scores
                .filter(item => item.score > 0.3)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            if (topResults.length === 0) return [];

            // 3. Fetch Content from Disk (Low RAM usage)
            const ids = topResults.map(r => `'${r.id}'`).join(',');
            const rows = await db.all(`SELECT id, content FROM vectors WHERE id IN (${ids})`);

            // 4. Merge Results
            return topResults.map(res => {
                const row = rows.find(r => r.id === res.id);
                return {
                    text: row ? row.content : "[MISSING DATA]",
                    score: res.score,
                    metadata: res.metadata
                };
            });

        } catch (e) {
            console.error("[VectorDB] Search Error:", e);
            return [];
        }
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
