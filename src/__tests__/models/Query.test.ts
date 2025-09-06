import { Query, IQuery } from '../../models/Query';
import { Enterprise } from '../../models/Enterprise';
import { User } from '../../models/User';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../helpers/database';
import mongoose from 'mongoose';

describe('Query Model', () => {
  let enterpriseId: mongoose.Types.ObjectId;
  let operatorId: mongoose.Types.ObjectId;

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

    const operator = await User.create({
      email: 'operator@example.com',
      role: 'operator',
      enterprises: [enterpriseId],
    });
    operatorId = operator._id;
  });

  describe('Validation', () => {
    it('should create a valid query with required fields', async () => {
      const queryData = {
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query text',
          intent: {
            name: 'test_intent',
            confidence: 0.85,
            matched_examples: ['example 1', 'example 2'],
          },
          confidence: 0.85,
          risk: 'low' as const,
          blocked: false,
          detected_language: 'en',
          processing_time_ms: 150,
          response_text: 'Test response',
        },
      };

      const query = new Query(queryData);
      const savedQuery = await query.save();

      expect(savedQuery.data.text).toBe('Test query text');
      expect(savedQuery.data.intent.name).toBe('test_intent');
      expect(savedQuery.data.risk).toBe('low');
      expect(savedQuery.created_at).toBeDefined();
    });

    it('should fail validation with empty text', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: '',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'low',
          blocked: false,
          detected_language: 'en',
          processing_time_ms: 100,
        },
      });

      await expect(query.save()).rejects.toThrow();
    });

    it('should fail validation with text too long', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'a'.repeat(5001), // Exceeds 5000 character limit
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'low',
          blocked: false,
          detected_language: 'en',
          processing_time_ms: 100,
        },
      });

      await expect(query.save()).rejects.toThrow();
    });

    it('should fail validation with invalid confidence range', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 1.5, matched_examples: [] }, // Invalid confidence > 1
          confidence: 0.5,
          risk: 'low',
          blocked: false,
          detected_language: 'en',
          processing_time_ms: 100,
        },
      });

      await expect(query.save()).rejects.toThrow();
    });

    it('should fail validation with invalid risk level', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'invalid' as any,
          blocked: false,
          detected_language: 'en',
          processing_time_ms: 100,
        },
      });

      await expect(query.save()).rejects.toThrow();
    });

    it('should fail validation with invalid language', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'low',
          blocked: false,
          detected_language: 'invalid_lang',
          processing_time_ms: 100,
        },
      });

      await expect(query.save()).rejects.toThrow();
    });

    it('should fail validation with negative processing time', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'low',
          blocked: false,
          detected_language: 'en',
          processing_time_ms: -100,
        },
      });

      await expect(query.save()).rejects.toThrow();
    });
  });

  describe('Business Logic Validation', () => {
    it('should fail validation when low/medium risk query is blocked', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'low', // Low risk but blocked
          blocked: true,
          detected_language: 'en',
          processing_time_ms: 100,
        },
      });

      await expect(query.save()).rejects.toThrow('Only high or critical risk queries should be blocked');
    });

    it('should allow high risk query to be blocked', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'high',
          blocked: true,
          detected_language: 'en',
          processing_time_ms: 100,
        },
      });

      const savedQuery = await query.save();
      expect(savedQuery.data.blocked).toBe(true);
    });

    it('should remove response_text when query is blocked', async () => {
      const query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'critical',
          blocked: true,
          detected_language: 'en',
          processing_time_ms: 100,
          response_text: 'This should be removed',
        },
      });

      const savedQuery = await query.save();
      expect(savedQuery.data.response_text).toBeUndefined();
    });
  });

  describe('Instance Methods', () => {
    let query: IQuery;

    beforeEach(async () => {
      query = new Query({
        enterprise_id: enterpriseId,
        operator_id: operatorId,
        data: {
          text: 'Test query',
          intent: { name: 'test', confidence: 0.5, matched_examples: [] },
          confidence: 0.5,
          risk: 'high',
          blocked: true,
          detected_language: 'en',
          processing_time_ms: 1500,
        },
      });
      await query.save();
    });

    it('should identify high risk queries', () => {
      expect(query.isHighRisk()).toBe(true);

      query.data.risk = 'low';
      expect(query.isHighRisk()).toBe(false);
    });

    it('should determine if alert should be created', () => {
      expect(query.shouldCreateAlert()).toBe(true); // High risk and blocked

      query.data.blocked = false;
      expect(query.shouldCreateAlert()).toBe(true); // Still high risk

      query.data.risk = 'low';
      expect(query.shouldCreateAlert()).toBe(false); // Low risk and not blocked
    });

    it('should convert processing time to seconds', () => {
      expect(query.getProcessingTimeSeconds()).toBe(1.5);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test queries
      await Query.create([
        {
          enterprise_id: enterpriseId,
          operator_id: operatorId,
          data: {
            text: 'Query 1',
            intent: { name: 'intent1', confidence: 0.8, matched_examples: [] },
            confidence: 0.8,
            risk: 'high',
            blocked: true,
            detected_language: 'en',
            processing_time_ms: 100,
          },
        },
        {
          enterprise_id: enterpriseId,
          operator_id: operatorId,
          data: {
            text: 'Query 2',
            intent: { name: 'intent2', confidence: 0.6, matched_examples: [] },
            confidence: 0.6,
            risk: 'low',
            blocked: false,
            detected_language: 'ta',
            processing_time_ms: 200,
          },
        },
        {
          enterprise_id: enterpriseId,
          operator_id: operatorId,
          data: {
            text: 'Query 3',
            intent: { name: 'intent3', confidence: 0.9, matched_examples: [] },
            confidence: 0.9,
            risk: 'critical',
            blocked: true,
            detected_language: 'tanglish',
            processing_time_ms: 300,
          },
        },
      ]);
    });

    it('should find queries by enterprise', async () => {
      const queries = await Query.findByEnterprise(enterpriseId);
      expect(queries).toHaveLength(3);
      expect(queries[0].created_at.getTime()).toBeGreaterThanOrEqual(
        queries[1].created_at.getTime()
      );
    });

    it('should filter queries by risk level', async () => {
      const highRiskQueries = await Query.findByEnterprise(enterpriseId, { risk: 'high' });
      expect(highRiskQueries).toHaveLength(1);
      expect(highRiskQueries[0].data.risk).toBe('high');
    });

    it('should filter queries by blocked status', async () => {
      const blockedQueries = await Query.findByEnterprise(enterpriseId, { blocked: true });
      expect(blockedQueries).toHaveLength(2);
      expect(blockedQueries.every(q => q.data.blocked)).toBe(true);
    });

    it('should filter queries by language', async () => {
      const englishQueries = await Query.findByEnterprise(enterpriseId, { language: 'en' });
      expect(englishQueries).toHaveLength(1);
      expect(englishQueries[0].data.detected_language).toBe('en');
    });

    it('should find high risk queries', async () => {
      const highRiskQueries = await Query.findHighRiskQueries(enterpriseId);
      expect(highRiskQueries).toHaveLength(2); // high and critical
      expect(highRiskQueries.every(q => ['high', 'critical'].includes(q.data.risk))).toBe(true);
    });

    it('should generate query statistics', async () => {
      const stats = await Query.getQueryStats(enterpriseId);
      expect(stats).toHaveLength(1);
      
      const stat = stats[0];
      expect(stat.total).toBe(3);
      expect(stat.blocked).toBe(2);
      expect(stat.high_risk).toBe(2);
      expect(stat.avg_processing_time).toBe(200); // (100 + 200 + 300) / 3
      expect(stat.languages).toEqual(expect.arrayContaining(['en', 'ta', 'tanglish']));
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for performance', async () => {
      const indexes = await Query.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      
      expect(indexNames).toContain('enterprise_id_1_created_at_-1');
      expect(indexNames).toContain('data.risk_1');
      expect(indexNames).toContain('data.blocked_1');
    });
  });
});