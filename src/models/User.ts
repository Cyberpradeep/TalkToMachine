import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../types';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IUser extends Document {
  email: string;
  role: UserRole;
  enterprises: mongoose.Types.ObjectId[];
  fcm_tokens: string[];
  created_at: Date;
  updated_at?: Date;
  last_active?: Date;
  
  // Instance methods
  hasAccessToEnterprise(enterpriseId: string | mongoose.Types.ObjectId): boolean;
  addFCMToken(token: string): void;
  removeFCMToken(token: string): void;
  updateLastActive(): void;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: validators.email.validator,
      message: validators.email.message,
    },
  },
  role: {
    type: String,
    required: [true, 'User role is required'],
    enum: {
      values: ['operator', 'enterprise_admin', 'super_admin'],
      message: 'Role must be one of: operator, enterprise_admin, super_admin',
    },
  },
  enterprises: [{
    type: Schema.Types.ObjectId,
    ref: 'Enterprise',
    validate: {
      validator: function(id: mongoose.Types.ObjectId) {
        return mongoose.Types.ObjectId.isValid(id);
      },
      message: 'Invalid enterprise ID',
    },
  }],
  fcm_tokens: [{
    type: String,
    trim: true,
    validate: {
      validator: function(token: string) {
        // FCM tokens are typically 152+ characters long
        return token.length >= 100 && token.length <= 200;
      },
      message: 'Invalid FCM token format',
    },
  }],
  last_active: {
    type: Date,
    validate: {
      validator: function(date: Date) {
        return !date || date <= new Date();
      },
      message: 'Last active date cannot be in the future',
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(userSchema);
BaseModel.addAuditLogging(userSchema, 'User');
BaseModel.addValidationErrorHandling(userSchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(userSchema, [
  { fields: { email: 1 }, options: { unique: true } },
  { fields: { role: 1 } },
  { fields: { enterprises: 1 } },
  { fields: { created_at: -1 } },
  { fields: { last_active: -1 } },
  { fields: { role: 1, enterprises: 1 } }, // Compound index for role-based enterprise queries
]);

// Pre-save middleware for validation
userSchema.pre('save', function(next) {
  // Validate role-enterprise relationship
  if (this.role === 'super_admin' && this.enterprises.length > 0) {
    return next(new Error('Super admin users should not be assigned to specific enterprises'));
  }
  
  if (this.role !== 'super_admin' && this.enterprises.length === 0) {
    return next(new Error('Non-super admin users must be assigned to at least one enterprise'));
  }

  // Remove duplicate FCM tokens
  if (this.fcm_tokens && this.fcm_tokens.length > 0) {
    this.fcm_tokens = [...new Set(this.fcm_tokens)];
  }

  next();
});

// Instance methods
userSchema.methods.hasAccessToEnterprise = function(enterpriseId: string | mongoose.Types.ObjectId): boolean {
  if (this.role === 'super_admin') {
    return true;
  }
  
  const enterpriseObjectId = typeof enterpriseId === 'string' 
    ? new mongoose.Types.ObjectId(enterpriseId) 
    : enterpriseId;
    
  return this.enterprises.some((id: mongoose.Types.ObjectId) => id.equals(enterpriseObjectId));
};

userSchema.methods.addFCMToken = function(token: string): void {
  if (!this.fcm_tokens.includes(token)) {
    this.fcm_tokens.push(token);
    // Keep only the last 5 tokens per user
    if (this.fcm_tokens.length > 5) {
      this.fcm_tokens = this.fcm_tokens.slice(-5);
    }
  }
};

userSchema.methods.removeFCMToken = function(token: string): void {
  this.fcm_tokens = this.fcm_tokens.filter((t: string) => t !== token);
};

userSchema.methods.updateLastActive = function(): void {
  this.last_active = new Date();
};

// Static methods
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByRole = function(role: UserRole) {
  return this.find({ role }).populate('enterprises');
};

userSchema.statics.findByEnterprise = function(enterpriseId: string | mongoose.Types.ObjectId) {
  return this.find({ enterprises: enterpriseId }).populate('enterprises');
};

// Define interface for static methods
interface IUserModel extends mongoose.Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findByRole(role: UserRole): Promise<IUser[]>;
  findByEnterprise(enterpriseId: string | mongoose.Types.ObjectId): Promise<IUser[]>;
}

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);