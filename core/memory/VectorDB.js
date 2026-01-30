const fs = require('fs');
const path = require('path');

class VectorDB {
    constructor(botCore) {
        this.botCore = botCore;
        // Persistence path
        this.dbPath = path.join(__dirname, '../../data/memory_vector.json');
        this.vectors = []; // Valid RAM Cache

        // Local model pipeline
        this.embeddingPipeline = null;
        this.loadingPromise = null;

        this.saveTimer = null;
        this.load();
    }

    /**
     * Init AI Model (Lazy Load with Race Condition Safety)
     */
    async init() {
        if (this.embeddingPipeline) return; // Already loaded

        // Check if loading is in progress
        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        console.log("[VectorDB] ⏳ Loading Local Embedding Model...");
        this.loadingPromise = (async () => {
            const { pipeline } = await import('@xenova/transformers');
            this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            console.log("[VectorDB] ✅ AI Model Ready!");
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
            await this.init(); // Ensure model loaded

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

        const entry = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text: text,
            vector: embedding,
            metadata: metadata,
            timestamp: new Date().toISOString()
        };

        this.vectors.push(entry);
        this.save();
        console.log(`[VectorDB] 🧠 Remembered: "${text.substring(0, 30)}..."`);
    }

    /**
     * Search relevant memories
     */
    async search(query, limit = 3) {
        const queryVector = await this.createEmbedding(query);
        if (!queryVector) return [];

        // Cosine Similarity
        const results = this.vectors.map(entry => {
            const score = this.cosineSimilarity(queryVector, entry.vector);
            return { ...entry, score };
        });

        // Rank & Filter
        return results
            .sort((a, b) => b.score - a.score)
            .filter(item => item.score > 0.3) // Threshold 30%
            .slice(0, limit)
            .map(item => ({ text: item.text, score: item.score, metadata: item.metadata }));
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

    save() {
        // Debounce: Wait 10 seconds after last change
        if (this.saveTimer) clearTimeout(this.saveTimer);

        this.saveTimer = setTimeout(() => {
            try {
                // Pruning (User Request)
                if (this.vectors.length > 1000) {
                    this.vectors = this.vectors.slice(-1000); // Chỉ giữ 1000 ký ức mới nhất
                }

                const dir = path.dirname(this.dbPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                // Async Write to prevent blocking event loop
                fs.writeFile(this.dbPath, JSON.stringify(this.vectors, null, 2), (err) => {
                    if (err) console.error("[VectorDB] ❌ Save Error:", err);
                    else console.log("[VectorDB] ✅ Memory saved (Auto-save).");
                });
            } catch (e) {
                console.error("[VectorDB] Save Prep Error:", e);
            }
        }, 10000);
    }

    load() {
        try {
            if (fs.existsSync(this.dbPath)) {
                this.vectors = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                console.log(`[VectorDB] Loaded ${this.vectors.length} memories.`);
            }
        } catch (e) {
            console.error("[VectorDB] Load Error:", e);
            this.vectors = [];
        }
    }
}

module.exports = VectorDB;
