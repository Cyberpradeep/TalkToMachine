import mongoose, { Schema, Document } from 'mongoose';
import { RiskLevel } from '../types';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IEnterprise extends Document {
  name: string;
  created_at: Date;
  updated_at?: Date;
  settings?: {
    risk_threshold: RiskLevel;
    allowed_languages: string[];
    max_query_length: number;
  };
  
  // Instance methods
  isLanguageAllowed(language: string): boolean;
  getRiskThreshold(): RiskLevel;
}

const enterpriseSchema = new Schema<IEnterprise>({
  name: {
    type: String,
    required: [true, 'Enterprise name is required'],
    trim: true,
    minlength: [2, 'Enterprise name must be at least 2 characters long'],
    maxlength: [100, 'Enterprise name cannot exceed 100 characters'],
    unique: true,
    validate: {
      validator: validators.nonEmptyString.validator,
      message: 'Enterprise name cannot be empty or just whitespace',
    },
  },
  settings: {
    risk_threshold: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: 'Risk threshold must be one of: low, medium, high, critical',
      },
      default: 'medium',
    },
    allowed_languages: {
      type: [String],
      default: ['en', 'ta', 'tanglish'],
      validate: {
        validator: function(languages: string[]) {
          const validLanguages = ['en', 'ta', 'tanglish', 'hi', 'es', 'fr', 'de'];
          return languages.every(lang => validLanguages.includes(lang));
        },
        message: 'Invalid language code in allowed_languages',
      },
    },
    max_query_length: {
      type: Number,
      default: 1000,
      min: [1, 'Max query length must be at least 1 character'],
      max: [5000, 'Max query length cannot exceed 5000 characters'],
      validate: {
        validator: validators.positiveNumber.validator,
        message: 'Max query length must be a positive number',
      },
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(enterpriseSchema);
BaseModel.addAuditLogging(enterpriseSchema, 'Enterprise');
BaseModel.addValidationErrorHandling(enterpriseSchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(enterpriseSchema, [
  { fields: { name: 1 }, options: { unique: true } },
  { fields: { created_at: -1 } },
  { fields: { 'settings.risk_threshold': 1 } },
]);

// Pre-save middleware for additional validation
enterpriseSchema.pre('save', function(next) {
  // Ensure settings object exists
  if (!this.settings) {
    this.settings = {
      risk_threshold: 'medium',
      allowed_languages: ['en', 'ta', 'tanglish'],
      max_query_length: 1000,
    };
  }
  next();
});

// Instance methods
enterpriseSchema.methods.isLanguageAllowed = function(language: string): boolean {
  return this.settings?.allowed_languages?.includes(language) ?? false;
};

enterpriseSchema.methods.getRiskThreshold = function(): RiskLevel {
  return this.settings?.risk_threshold ?? 'medium';
};

// Static methods
enterpriseSchema.statics.findByName = function(name: string) {
  return this.findOne({ name: new RegExp(`^${name}$`, 'i') });
};

enterpriseSchema.statics.getActiveEnterprises = function() {
  return this.find({}).sort({ created_at: -1 });
};

// Define interface for static methods
interface IEnterpriseModel extends mongoose.Model<IEnterprise> {
  findByName(name: string): Promise<IEnterprise | null>;
  getActiveEnterprises(): Promise<IEnterprise[]>;
}

export const Enterprise = mongoose.model<IEnterprise, IEnterpriseModel>('Enterprise', enterpriseSchema);