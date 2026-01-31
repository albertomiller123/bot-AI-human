const db = require('../database/DatabaseManager');

class VectorDB {
    constructor(botCore) {
        this.botCore = botCore;
        this.vectors = []; // RAM Cache for fast search (sync with DB)

        // Local model pipeline
        this.embeddingPipeline = null;
        this.loadingPromise = null;

        // Initialize DB and load data
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
            await this.load();
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
        const entry = {
            id: id,
            text: text,
            vector: embedding,
            metadata: metadata,
            timestamp: timestamp
        };

        // Update RAM
        this.vectors.push(entry);

        // Async Insert to DB (Non-blocking)
        db.run(
            `INSERT INTO vectors (id, content, embedding, metadata, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [id, text, JSON.stringify(embedding), JSON.stringify(metadata), timestamp]
        ).then(() => {
            console.log(`[VectorDB] 🧠 Remembered: "${text.substring(0, 30)}..."`);
        }).catch(err => {
            console.error("[VectorDB] ❌ Save Error:", err);
        });

        // Pruning RAM if too large (optional, prevents memory leak)
        if (this.vectors.length > 2000) {
            // We might want to keep most recent or most relevant?
            // For now, simple slice to prevent crash, but DB has everything.
            this.vectors = this.vectors.slice(-2000);
        }
    }

    /**
     * Search relevant memories
     */
    async search(query, limit = 3) {
        const queryVector = await this.createEmbedding(query);
        if (!queryVector) return [];

        // Cosine Similarity on RAM cache
        // Improvement: We could fetch from DB if RAM is partial, but for now RAM = Full DB (mostly)
        const results = this.vectors.map(entry => {
            const score = this.cosineSimilarity(queryVector, entry.vector);
            return { ...entry, score };
        });

        // Rank & Filter
        return results
            .sort((a, b) => b.score - a.score)
            .filter(item => item.score > 0.3) // Threshold 30%
            .slice(0, limit)
            .map(item => ({ text: item.text || item.content, score: item.score, metadata: item.metadata }));
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

    async load() {
        try {
            console.log("[VectorDB] Loading memories from SQLite...");
            const rows = await db.all("SELECT * FROM vectors ORDER BY timestamp ASC"); // Oldest first? or Newest?

            this.vectors = rows.map(row => ({
                id: row.id,
                text: row.content,
                vector: JSON.parse(row.embedding),
                metadata: JSON.parse(row.metadata || '{}'),
                timestamp: row.timestamp
            }));

            console.log(`[VectorDB] Loaded ${this.vectors.length} memories from DB.`);
        } catch (e) {
            console.error("[VectorDB] Load Error:", e);
            this.vectors = [];
        }
    }
}

module.exports = VectorDB;
