import { User, IUser } from '../../models/User';
import { Enterprise } from '../../models/Enterprise';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase, createTestObjectId } from '../helpers/database';
import mongoose from 'mongoose';

describe('User Model', () => {
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
    let enterpriseId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const enterprise = await Enterprise.create({ name: 'Test Enterprise' });
      enterpriseId = enterprise._id;
    });

    it('should create a valid user with required fields', async () => {
      const userData = {
        email: 'test@example.com',
        role: 'operator' as const,
        enterprises: [enterpriseId],
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.email).toBe('test@example.com');
      expect(savedUser.role).toBe('operator');
      expect(savedUser.enterprises).toHaveLength(1);
      expect(savedUser.created_at).toBeDefined();
    });

    it('should fail validation with invalid email', async () => {
      const user = new User({
        email: 'invalid-email',
        role: 'operator',
        enterprises: [enterpriseId],
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should fail validation with invalid role', async () => {
      const user = new User({
        email: 'test@example.com',
        role: 'invalid_role' as any,
        enterprises: [enterpriseId],
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      const user1 = new User({
        email: 'unique@example.com',
        role: 'operator',
        enterprises: [enterpriseId],
      });
      await user1.save();

      const user2 = new User({
        email: 'unique@example.com',
        role: 'enterprise_admin',
        enterprises: [enterpriseId],
      });

      await expect(user2.save()).rejects.toThrow();
    });

    it('should convert email to lowercase', async () => {
      const user = new User({
        email: 'TEST@EXAMPLE.COM',
        role: 'operator',
        enterprises: [enterpriseId],
      });

      const savedUser = await user.save();
      expect(savedUser.email).toBe('test@example.com');
    });

    it('should validate FCM token format', async () => {
      const user = new User({
        email: 'test@example.com',
        role: 'operator',
        enterprises: [enterpriseId],
        fcm_tokens: ['short'], // Too short
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should validate future last_active date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const user = new User({
        email: 'test@example.com',
        role: 'operator',
        enterprises: [enterpriseId],
        last_active: futureDate,
      });

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Role-Enterprise Validation', () => {
    let enterpriseId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const enterprise = await Enterprise.create({ name: 'Test Enterprise' });
      enterpriseId = enterprise._id;
    });

    it('should allow super_admin with no enterprises', async () => {
      const user = new User({
        email: 'superadmin@example.com',
        role: 'super_admin',
        enterprises: [],
      });

      const savedUser = await user.save();
      expect(savedUser.role).toBe('super_admin');
      expect(savedUser.enterprises).toHaveLength(0);
    });

    it('should fail validation for super_admin with enterprises', async () => {
      const user = new User({
        email: 'superadmin@example.com',
        role: 'super_admin',
        enterprises: [enterpriseId],
      });

      await expect(user.save()).rejects.toThrow('Super admin users should not be assigned to specific enterprises');
    });

    it('should fail validation for non-super_admin without enterprises', async () => {
      const user = new User({
        email: 'operator@example.com',
        role: 'operator',
        enterprises: [],
      });

      await expect(user.save()).rejects.toThrow('Non-super admin users must be assigned to at least one enterprise');
    });
  });

  describe('Instance Methods', () => {
    let user: IUser;
    let enterpriseId1: mongoose.Types.ObjectId;
    let enterpriseId2: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const enterprise1 = await Enterprise.create({ name: 'Enterprise 1' });
      const enterprise2 = await Enterprise.create({ name: 'Enterprise 2' });
      enterpriseId1 = enterprise1._id;
      enterpriseId2 = enterprise2._id;

      user = new User({
        email: 'test@example.com',
        role: 'enterprise_admin',
        enterprises: [enterpriseId1],
      });
      await user.save();
    });

    it('should check access to enterprise for regular user', () => {
      expect(user.hasAccessToEnterprise(enterpriseId1)).toBe(true);
      expect(user.hasAccessToEnterprise(enterpriseId2)).toBe(false);
    });

    it('should allow access to all enterprises for super_admin', async () => {
      const superAdmin = new User({
        email: 'superadmin@example.com',
        role: 'super_admin',
        enterprises: [],
      });
      await superAdmin.save();

      expect(superAdmin.hasAccessToEnterprise(enterpriseId1)).toBe(true);
      expect(superAdmin.hasAccessToEnterprise(enterpriseId2)).toBe(true);
    });

    it('should add FCM token', () => {
      const token = 'a'.repeat(150); // Valid length token
      user.addFCMToken(token);

      expect(user.fcm_tokens).toContain(token);
    });

    it('should not add duplicate FCM tokens', () => {
      const token = 'a'.repeat(150);
      user.addFCMToken(token);
      user.addFCMToken(token);

      expect(user.fcm_tokens.filter(t => t === token)).toHaveLength(1);
    });

    it('should limit FCM tokens to 5', () => {
      for (let i = 0; i < 7; i++) {
        user.addFCMToken('a'.repeat(149) + i);
      }

      expect(user.fcm_tokens).toHaveLength(5);
    });

    it('should remove FCM token', () => {
      const token = 'a'.repeat(150);
      user.addFCMToken(token);
      user.removeFCMToken(token);

      expect(user.fcm_tokens).not.toContain(token);
    });

    it('should update last active timestamp', () => {
      const beforeUpdate = new Date();
      user.updateLastActive();

      expect(user.last_active).toBeDefined();
      expect(user.last_active!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('Static Methods', () => {
    let enterpriseId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const enterprise = await Enterprise.create({ name: 'Test Enterprise' });
      enterpriseId = enterprise._id;

      await User.create([
        {
          email: 'operator@example.com',
          role: 'operator',
          enterprises: [enterpriseId],
        },
        {
          email: 'admin@example.com',
          role: 'enterprise_admin',
          enterprises: [enterpriseId],
        },
        {
          email: 'superadmin@example.com',
          role: 'super_admin',
          enterprises: [],
        },
      ]);
    });

    it('should find user by email', async () => {
      const user = await User.findByEmail('OPERATOR@EXAMPLE.COM'); // Test case insensitive
      expect(user).toBeTruthy();
      expect(user?.email).toBe('operator@example.com');
    });

    it('should find users by role', async () => {
      const operators = await User.findByRole('operator');
      expect(operators).toHaveLength(1);
      expect(operators[0].role).toBe('operator');
    });

    it('should find users by enterprise', async () => {
      const users = await User.findByEnterprise(enterpriseId);
      expect(users).toHaveLength(2); // operator and admin, not super_admin
    });
  });

  describe('Middleware', () => {
    let enterpriseId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const enterprise = await Enterprise.create({ name: 'Test Enterprise' });
      enterpriseId = enterprise._id;
    });

    it('should remove duplicate FCM tokens on save', async () => {
      const token = 'a'.repeat(150);
      const user = new User({
        email: 'test@example.com',
        role: 'operator',
        enterprises: [enterpriseId],
        fcm_tokens: [token, token, token], // Duplicates
      });

      const savedUser = await user.save();
      expect(savedUser.fcm_tokens).toHaveLength(1);
      expect(savedUser.fcm_tokens[0]).toBe(token);
    });
  });
});