import mongoose, { Schema, Document } from 'mongoose';
import { IntentResult, RiskLevel } from '../types';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IQuery extends Document {
  enterprise_id: mongoose.Types.ObjectId;
  operator_id: mongoose.Types.ObjectId;
  data: {
    text: string;
    intent: IntentResult;
    confidence: number;
    risk: RiskLevel;
    blocked: boolean;
    detected_language: string;
    processing_time_ms: number;
    response_text?: string;
  };
  created_at: Date;
  updated_at?: Date;
  
  // Instance methods
  isHighRisk(): boolean;
  shouldCreateAlert(): boolean;
  getProcessingTimeSeconds(): number;
}

const querySchema = new Schema<IQuery>({
  enterprise_id: {
    type: Schema.Types.ObjectId,
    ref: 'Enterprise',
    required: [true, 'Enterprise ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  operator_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Operator ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  data: {
    text: {
      type: String,
      required: [true, 'Query text is required'],
      trim: true,
      minlength: [1, 'Query text cannot be empty'],
      maxlength: [5000, 'Query text cannot exceed 5000 characters'],
      validate: {
        validator: validators.nonEmptyString.validator,
        message: 'Query text cannot be empty or just whitespace',
      },
    },
    intent: {
      name: {
        type: String,
        required: [true, 'Intent name is required'],
        trim: true,
        validate: {
          validator: validators.nonEmptyString.validator,
          message: 'Intent name cannot be empty',
        },
      },
      confidence: {
        type: Number,
        required: [true, 'Intent confidence is required'],
        min: [0, 'Intent confidence must be between 0 and 1'],
        max: [1, 'Intent confidence must be between 0 and 1'],
      },
      matched_examples: [{
        type: String,
        trim: true,
        maxlength: [500, 'Matched example cannot exceed 500 characters'],
      }],
    },
    confidence: {
      type: Number,
      required: [true, 'Overall confidence is required'],
      min: [0, 'Confidence must be between 0 and 1'],
      max: [1, 'Confidence must be between 0 and 1'],
    },
    risk: {
      type: String,
      required: [true, 'Risk level is required'],
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: 'Risk level must be one of: low, medium, high, critical',
      },
    },
    blocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    detected_language: {
      type: String,
      required: [true, 'Detected language is required'],
      trim: true,
      validate: {
        validator: function(lang: string) {
          const validLanguages = ['en', 'ta', 'tanglish', 'hi', 'es', 'fr', 'de', 'unknown'];
          return validLanguages.includes(lang);
        },
        message: 'Invalid language code',
      },
    },
    processing_time_ms: {
      type: Number,
      required: [true, 'Processing time is required'],
      min: [0, 'Processing time must be non-negative'],
      validate: {
        validator: function(time: number) {
          return Number.isInteger(time) && time >= 0;
        },
        message: 'Processing time must be a non-negative integer',
      },
    },
    response_text: {
      type: String,
      trim: true,
      maxlength: [5000, 'Response text cannot exceed 5000 characters'],
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(querySchema);
BaseModel.addAuditLogging(querySchema, 'Query');
BaseModel.addValidationErrorHandling(querySchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(querySchema, [
  { fields: { enterprise_id: 1, created_at: -1 } },
  { fields: { operator_id: 1, created_at: -1 } },
  { fields: { 'data.risk': 1 } },
  { fields: { 'data.blocked': 1 } },
  { fields: { 'data.detected_language': 1 } },
  { fields: { created_at: -1 } },
  { fields: { enterprise_id: 1, 'data.risk': 1, created_at: -1 } }, // Compound index for enterprise risk queries
  { fields: { 'data.blocked': 1, 'data.risk': 1 } }, // Index for blocked high-risk queries
]);

// Pre-save middleware for validation
querySchema.pre('save', function(this: IQuery, next) {
  // Validate that blocked queries have high risk
  if (this.data.blocked && !['high', 'critical'].includes(this.data.risk)) {
    return next(new Error('Only high or critical risk queries should be blocked'));
  }

  // Ensure response_text is only set for non-blocked queries
  if (this.data.blocked && this.data.response_text) {
    this.data.response_text = undefined;
  }

  next();
});

// Instance methods
querySchema.methods.isHighRisk = function(): boolean {
  return ['high', 'critical'].includes(this.data.risk);
};

querySchema.methods.shouldCreateAlert = function(): boolean {
  return this.data.blocked || this.isHighRisk();
};

querySchema.methods.getProcessingTimeSeconds = function(): number {
  return this.data.processing_time_ms / 1000;
};

// Static methods
querySchema.statics.findByEnterprise = function(enterpriseId: string | mongoose.Types.ObjectId, options: any = {}) {
  const query = this.find({ enterprise_id: enterpriseId });
  
  if (options.risk) {
    query.where('data.risk').equals(options.risk);
  }
  
  if (options.blocked !== undefined) {
    query.where('data.blocked').equals(options.blocked);
  }
  
  if (options.language) {
    query.where('data.detected_language').equals(options.language);
  }
  
  return query.sort({ created_at: -1 }).populate('operator_id', 'email role');
};

querySchema.statics.findHighRiskQueries = function(enterpriseId?: string | mongoose.Types.ObjectId) {
  const query = this.find({ 'data.risk': { $in: ['high', 'critical'] } });
  
  if (enterpriseId) {
    query.where('enterprise_id').equals(enterpriseId);
  }
  
  return query.sort({ created_at: -1 }).populate('operator_id enterprise_id');
};

querySchema.statics.getQueryStats = function(enterpriseId: string | mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { enterprise_id: new mongoose.Types.ObjectId(enterpriseId.toString()) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        blocked: { $sum: { $cond: ['$data.blocked', 1, 0] } },
        high_risk: { $sum: { $cond: [{ $in: ['$data.risk', ['high', 'critical']] }, 1, 0] } },
        avg_processing_time: { $avg: '$data.processing_time_ms' },
        languages: { $addToSet: '$data.detected_language' },
      },
    },
  ]);
};

// Define interface for static methods
interface IQueryModel extends mongoose.Model<IQuery> {
  findByEnterprise(enterpriseId: string | mongoose.Types.ObjectId, options?: any): Promise<IQuery[]>;
  findHighRiskQueries(enterpriseId?: string | mongoose.Types.ObjectId): Promise<IQuery[]>;
  getQueryStats(enterpriseId: string | mongoose.Types.ObjectId): Promise<any[]>;
}

export const Query = mongoose.model<IQuery, IQueryModel>('Query', querySchema);