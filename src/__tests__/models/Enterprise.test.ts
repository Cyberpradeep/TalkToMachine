import { Enterprise, IEnterprise } from '../../models/Enterprise';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../helpers/database';

describe('Enterprise Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('Validation', () => {
    it('should create a valid enterprise with required fields', async () => {
      const enterpriseData = {
        name: 'Test Enterprise',
      };

      const enterprise = new Enterprise(enterpriseData);
      const savedEnterprise = await enterprise.save();

      expect(savedEnterprise.name).toBe('Test Enterprise');
      expect(savedEnterprise.created_at).toBeDefined();
      expect(savedEnterprise.settings?.risk_threshold).toBe('medium');
      expect(savedEnterprise.settings?.allowed_languages).toEqual(['en', 'ta', 'tanglish']);
      expect(savedEnterprise.settings?.max_query_length).toBe(1000);
    });

    it('should fail validation with empty name', async () => {
      const enterprise = new Enterprise({ name: '' });

      await expect(enterprise.save()).rejects.toThrow();
    });

    it('should fail validation with name too long', async () => {
      const enterprise = new Enterprise({ 
        name: 'a'.repeat(101) // 101 characters
      });

      await expect(enterprise.save()).rejects.toThrow();
    });

    it('should fail validation with invalid risk threshold', async () => {
      const enterprise = new Enterprise({
        name: 'Test Enterprise',
        settings: {
          risk_threshold: 'invalid' as any,
          allowed_languages: ['en'],
          max_query_length: 1000,
        },
      });

      await expect(enterprise.save()).rejects.toThrow();
    });

    it('should fail validation with invalid language code', async () => {
      const enterprise = new Enterprise({
        name: 'Test Enterprise',
        settings: {
          risk_threshold: 'medium',
          allowed_languages: ['invalid_lang'],
          max_query_length: 1000,
        },
      });

      await expect(enterprise.save()).rejects.toThrow();
    });

    it('should fail validation with invalid max_query_length', async () => {
      const enterprise = new Enterprise({
        name: 'Test Enterprise',
        settings: {
          risk_threshold: 'medium',
          allowed_languages: ['en'],
          max_query_length: 0,
        },
      });

      await expect(enterprise.save()).rejects.toThrow();
    });

    it('should enforce unique name constraint', async () => {
      const enterprise1 = new Enterprise({ name: 'Unique Enterprise' });
      await enterprise1.save();

      const enterprise2 = new Enterprise({ name: 'Unique Enterprise' });
      await expect(enterprise2.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let enterprise: IEnterprise;

    beforeEach(async () => {
      enterprise = new Enterprise({
        name: 'Test Enterprise',
        settings: {
          risk_threshold: 'high',
          allowed_languages: ['en', 'ta'],
          max_query_length: 2000,
        },
      });
      await enterprise.save();
    });

    it('should check if language is allowed', () => {
      expect(enterprise.isLanguageAllowed('en')).toBe(true);
      expect(enterprise.isLanguageAllowed('ta')).toBe(true);
      expect(enterprise.isLanguageAllowed('fr')).toBe(false);
    });

    it('should get risk threshold', () => {
      expect(enterprise.getRiskThreshold()).toBe('high');
    });

    it('should handle missing settings gracefully', async () => {
      const minimalEnterprise = new Enterprise({ name: 'Minimal Enterprise' });
      await minimalEnterprise.save();

      expect(minimalEnterprise.getRiskThreshold()).toBe('medium');
      expect(minimalEnterprise.isLanguageAllowed('en')).toBe(true);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await Enterprise.create([
        { name: 'Enterprise One' },
        { name: 'Enterprise Two' },
        { name: 'enterprise three' }, // lowercase to test case-insensitive search
      ]);
    });

    it('should find enterprise by name (case-insensitive)', async () => {
      const enterprise = await Enterprise.findByName('ENTERPRISE ONE');
      expect(enterprise).toBeTruthy();
      expect(enterprise?.name).toBe('Enterprise One');
    });

    it('should return null for non-existent enterprise', async () => {
      const enterprise = await Enterprise.findByName('Non-existent');
      expect(enterprise).toBeNull();
    });

    it('should get all active enterprises', async () => {
      const enterprises = await Enterprise.getActiveEnterprises();
      expect(enterprises).toHaveLength(3);
      expect(enterprises[0].created_at.getTime()).toBeGreaterThanOrEqual(
        enterprises[1].created_at.getTime()
      );
    });
  });

  describe('Middleware', () => {
    it('should auto-populate settings on save', async () => {
      const enterprise = new Enterprise({ name: 'Auto Settings Enterprise' });
      const saved = await enterprise.save();

      expect(saved.settings).toBeDefined();
      expect(saved.settings?.risk_threshold).toBe('medium');
      expect(saved.settings?.allowed_languages).toEqual(['en', 'ta', 'tanglish']);
      expect(saved.settings?.max_query_length).toBe(1000);
    });

    it('should set updated_at on modification', async () => {
      const enterprise = new Enterprise({ name: 'Update Test Enterprise' });
      const saved = await enterprise.save();
      
      const originalUpdatedAt = saved.updated_at;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      saved.name = 'Updated Name';
      const updated = await saved.save();
      
      expect(updated.updated_at).toBeDefined();
      if (originalUpdatedAt) {
        expect(updated.updated_at!.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for performance', async () => {
      const indexes = await Enterprise.collection.getIndexes();
      
      // Check that required indexes exist
      const indexNames = Object.keys(indexes);
      expect(indexNames).toContain('name_1');
      expect(indexNames).toContain('created_at_-1');
    });
  });
});