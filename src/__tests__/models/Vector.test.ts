import { Vector, IVector } from '../../models/Vector';
import { Enterprise } from '../../models/Enterprise';
import { User } from '../../models/User';
import { Manual } from '../../models/Manual';
import { Chunk } from '../../models/Chunk';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase, createTestEmbedding } from '../helpers/database';
import mongoose from 'mongoose';

describe('Vector Model', () => {
  let enterpriseId: mongoose.Types.ObjectId;
  let chunkId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const enterprise = await Enterprise.create({ name: 'Test Enterprise' });
    enterpriseId = enterprise._id;

    const user = await User.create({
      email: 'user@example.com',
      role: 'enterprise_admin',
      enterprises: [enterpriseId],
    });

    const manual = await Manual.create({
      enterprise_id: enterpriseId,
      filename: 'test.pdf',
      original_name: 'test.pdf',
      size: 1000,
      mime_type: 'application/pdf',
      uploaded_by: user._id,
      processing_status: 'completed',
    });

    const chunk = await Chunk.create({
      manual_id: manual._id,
      enterprise_id: enterpriseId,
      text: 'Test chunk text',
      order: 0,
      metadata: {
        word_count: 3,
        char_count: 15,
      },
    });
    chunkId = chunk._id;
  });

  describe('Validation', () => {
    it('should create a valid vector with required fields', async () => {
      const embedding = createTestEmbedding(384);
      
      const vectorData = {
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: embedding,
        model_version: 'all-MiniLM-L6-v2',
      };

      const vector = new Vector(vectorData);
      const savedVector = await vector.save();

      expect(savedVector.embedding).toHaveLength(384);
      expect(savedVector.model_version).toBe('all-MiniLM-L6-v2');
      expect(savedVector.created_at).toBeDefined();
    });

    it('should fail validation with wrong embedding dimension', async () => {
      const vector = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: [1, 2, 3], // Wrong dimension
        model_version: 'all-MiniLM-L6-v2',
      });

      await expect(vector.save()).rejects.toThrow('Embedding must have exactly 384 dimensions');
    });

    it('should fail validation with invalid embedding values', async () => {
      const embedding = new Array(384).fill(NaN);
      
      const vector = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: embedding,
        model_version: 'all-MiniLM-L6-v2',
      });

      await expect(vector.save()).rejects.toThrow('All embedding values must be valid finite numbers');
    });

    it('should fail validation with zero magnitude vector', async () => {
      const embedding = new Array(384).fill(0);
      
      const vector = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: embedding,
        model_version: 'all-MiniLM-L6-v2',
      });

      await expect(vector.save()).rejects.toThrow('Embedding vector appears to be invalid');
    });

    it('should fail validation with invalid model version', async () => {
      const embedding = createTestEmbedding(384);
      
      const vector = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: embedding,
        model_version: 'invalid-model',
      });

      await expect(vector.save()).rejects.toThrow('Invalid model version');
    });

    it('should enforce unique chunk_id constraint', async () => {
      const embedding1 = createTestEmbedding(384);
      const embedding2 = createTestEmbedding(384);

      const vector1 = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: embedding1,
        model_version: 'all-MiniLM-L6-v2',
      });
      await vector1.save();

      const vector2 = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId, // Same chunk_id
        embedding: embedding2,
        model_version: 'all-MiniLM-L6-v2',
      });

      await expect(vector2.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let vector: IVector;
    let testEmbedding: number[];

    beforeEach(async () => {
      testEmbedding = createTestEmbedding(384);
      
      vector = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: testEmbedding,
        model_version: 'all-MiniLM-L6-v2',
      });
      await vector.save();
    });

    it('should calculate cosine similarity correctly', () => {
      const otherEmbedding = createTestEmbedding(384);
      const similarity = vector.cosineSimilarity(otherEmbedding);
      
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should calculate similarity with itself as 1', () => {
      const similarity = vector.cosineSimilarity(vector.embedding);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should throw error for invalid embedding in similarity calculation', () => {
      expect(() => {
        vector.cosineSimilarity([1, 2, 3]); // Wrong dimension
      }).toThrow('Invalid embedding for similarity calculation');
    });

    it('should calculate vector magnitude', () => {
      const magnitude = vector.getMagnitude();
      expect(magnitude).toBeGreaterThan(0);
      expect(magnitude).toBeCloseTo(1, 1); // Should be close to 1 for normalized vector
    });

    it('should check if vector is normalized', () => {
      expect(vector.isNormalized()).toBe(true);
    });

    it('should normalize vector', () => {
      const normalized = vector.normalize();
      expect(normalized).toHaveLength(384);
      
      const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should throw error when normalizing zero vector', () => {
      vector.embedding = new Array(384).fill(0);
      
      expect(() => {
        vector.normalize();
      }).toThrow('Cannot normalize zero vector');
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create additional chunks and vectors for testing
      const user = await User.findOne({ email: 'user@example.com' });
      const manual = await Manual.findOne({ filename: 'test.pdf' });

      const chunk2 = await Chunk.create({
        manual_id: manual!._id,
        enterprise_id: enterpriseId,
        text: 'Second chunk text',
        order: 1,
        metadata: { word_count: 3, char_count: 18 },
      });

      await Vector.create([
        {
          enterprise_id: enterpriseId,
          chunk_id: chunkId,
          embedding: createTestEmbedding(384),
          model_version: 'all-MiniLM-L6-v2',
        },
        {
          enterprise_id: enterpriseId,
          chunk_id: chunk2._id,
          embedding: createTestEmbedding(384),
          model_version: 'all-mpnet-base-v2',
        },
      ]);
    });

    it('should find vectors by enterprise', async () => {
      const vectors = await Vector.findByEnterprise(enterpriseId);
      expect(vectors).toHaveLength(2);
      expect(vectors[0].chunk_id).toBeDefined();
    });

    it('should find vectors by model version', async () => {
      const vectors = await Vector.findByModel('all-MiniLM-L6-v2', enterpriseId);
      expect(vectors).toHaveLength(1);
      expect(vectors[0].model_version).toBe('all-MiniLM-L6-v2');
    });

    it('should find similar vectors', async () => {
      const queryEmbedding = createTestEmbedding(384);
      const similarVectors = await Vector.findSimilar(queryEmbedding, enterpriseId, 5, 0.0);
      
      expect(similarVectors).toHaveLength(2);
      expect(similarVectors[0]).toHaveProperty('similarity');
      expect(similarVectors[0].similarity).toBeGreaterThanOrEqual(0);
    });

    it('should filter similar vectors by threshold', async () => {
      const queryEmbedding = createTestEmbedding(384);
      const similarVectors = await Vector.findSimilar(queryEmbedding, enterpriseId, 5, 0.9);
      
      // With high threshold, might get fewer results
      expect(similarVectors.length).toBeLessThanOrEqual(2);
      if (similarVectors.length > 0) {
        expect(similarVectors[0].similarity).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should generate vector statistics', async () => {
      const stats = await Vector.getVectorStats(enterpriseId);
      expect(stats).toHaveLength(1);
      
      const stat = stats[0];
      expect(stat.total_vectors).toBe(2);
      expect(stat.models).toHaveLength(2);
      expect(stat.models.some((m: any) => m.version === 'all-MiniLM-L6-v2')).toBe(true);
      expect(stat.models.some((m: any) => m.version === 'all-mpnet-base-v2')).toBe(true);
    });
  });

  describe('Middleware', () => {
    it('should round embedding values to reasonable precision', async () => {
      const preciseEmbedding = createTestEmbedding(384).map(val => val + 0.1234567890123456);
      
      const vector = new Vector({
        enterprise_id: enterpriseId,
        chunk_id: chunkId,
        embedding: preciseEmbedding,
        model_version: 'all-MiniLM-L6-v2',
      });

      const savedVector = await vector.save();
      
      // Check that values are rounded to 6 decimal places
      savedVector.embedding.forEach(val => {
        const rounded = Math.round(val * 1000000) / 1000000;
        expect(val).toBe(rounded);
      });
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for performance', async () => {
      const indexes = await Vector.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      
      expect(indexNames).toContain('enterprise_id_1');
      expect(indexNames).toContain('chunk_id_1');
      expect(indexNames).toContain('model_version_1');
    });
  });
});