import mongoose, { Schema, Document } from 'mongoose';
import { IntentResult, RiskLevel } from '../types';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IAlert extends Document {
  enterprise_id: mongoose.Types.ObjectId;
  operator_id: mongoose.Types.ObjectId;
  data: {
    text: string;
    intent: IntentResult;
    risk: RiskLevel;
    language: string;
    trigger_reason: string;
  };
  created_at: Date;
  updated_at?: Date;
  acknowledged?: Date;
  acknowledged_by?: mongoose.Types.ObjectId;
}

const alertSchema = new Schema<IAlert>({
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
      required: [true, 'Alert text is required'],
      trim: true,
      minlength: [1, 'Alert text cannot be empty'],
      maxlength: [5000, 'Alert text cannot exceed 5000 characters'],
      validate: {
        validator: validators.nonEmptyString.validator,
        message: 'Alert text cannot be empty or just whitespace',
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
    risk: {
      type: String,
      required: [true, 'Risk level is required'],
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: 'Risk level must be one of: low, medium, high, critical',
      },
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true,
      validate: {
        validator: function(lang: string) {
          const validLanguages = ['en', 'ta', 'tanglish', 'hi', 'es', 'fr', 'de', 'unknown'];
          return validLanguages.includes(lang);
        },
        message: 'Invalid language code',
      },
    },
    trigger_reason: {
      type: String,
      required: [true, 'Trigger reason is required'],
      trim: true,
      minlength: [1, 'Trigger reason cannot be empty'],
      maxlength: [500, 'Trigger reason cannot exceed 500 characters'],
      validate: {
        validator: validators.nonEmptyString.validator,
        message: 'Trigger reason cannot be empty or just whitespace',
      },
    },
  },
  acknowledged: {
    type: Date,
    validate: {
      validator: function(date: Date) {
        return !date || date <= new Date();
      },
      message: 'Acknowledged date cannot be in the future',
    },
  },
  acknowledged_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: function(id: mongoose.Types.ObjectId) {
        // Only validate if acknowledged_by is set
        return !id || mongoose.Types.ObjectId.isValid(id);
      },
      message: 'Invalid acknowledged_by user ID',
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(alertSchema);
BaseModel.addAuditLogging(alertSchema, 'Alert');
BaseModel.addValidationErrorHandling(alertSchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(alertSchema, [
  { fields: { enterprise_id: 1, created_at: -1 } },
  { fields: { 'data.risk': 1, created_at: -1 } },
  { fields: { acknowledged: 1 } },
  { fields: { created_at: -1 } },
  { fields: { enterprise_id: 1, acknowledged: 1, 'data.risk': 1 } }, // Compound index for unacknowledged alerts by risk
  { fields: { operator_id: 1, created_at: -1 } },
]);

// Pre-save middleware for validation
alertSchema.pre('save', function(next) {
  // Validate acknowledged_by is set when acknowledged date is set
  if (this.acknowledged && !this.acknowledged_by) {
    return next(new Error('acknowledged_by must be set when alert is acknowledged'));
  }

  // Validate acknowledged_by is not set when acknowledged date is not set
  if (!this.acknowledged && this.acknowledged_by) {
    return next(new Error('acknowledged_by should not be set when alert is not acknowledged'));
  }

  // Ensure alerts are only created for medium+ risk levels
  if (!['medium', 'high', 'critical'].includes(this.data.risk)) {
    return next(new Error('Alerts should only be created for medium, high, or critical risk levels'));
  }

  next();
});

// Instance methods
alertSchema.methods.acknowledge = function(userId: string | mongoose.Types.ObjectId): void {
  this.acknowledged = new Date();
  this.acknowledged_by = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
};

alertSchema.methods.isAcknowledged = function(): boolean {
  return !!this.acknowledged;
};

alertSchema.methods.isCritical = function(): boolean {
  return this.data.risk === 'critical';
};

alertSchema.methods.getAgeInHours = function(): number {
  const now = new Date();
  const created = new Date(this.created_at);
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
};

// Static methods
alertSchema.statics.findUnacknowledged = function(enterpriseId?: string | mongoose.Types.ObjectId) {
  const query = this.find({ acknowledged: { $exists: false } });
  
  if (enterpriseId) {
    query.where('enterprise_id').equals(enterpriseId);
  }
  
  return query.sort({ 'data.risk': -1, created_at: -1 }).populate('operator_id enterprise_id');
};

alertSchema.statics.findByRisk = function(risk: RiskLevel, enterpriseId?: string | mongoose.Types.ObjectId) {
  const query = this.find({ 'data.risk': risk });
  
  if (enterpriseId) {
    query.where('enterprise_id').equals(enterpriseId);
  }
  
  return query.sort({ created_at: -1 }).populate('operator_id enterprise_id');
};

alertSchema.statics.getAlertStats = function(enterpriseId: string | mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { enterprise_id: new mongoose.Types.ObjectId(enterpriseId.toString()) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unacknowledged: { $sum: { $cond: [{ $exists: ['$acknowledged', false] }, 1, 0] } },
        critical: { $sum: { $cond: [{ $eq: ['$data.risk', 'critical'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$data.risk', 'high'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$data.risk', 'medium'] }, 1, 0] } },
        avg_acknowledgment_time: {
          $avg: {
            $cond: [
              { $exists: ['$acknowledged', true] },
              { $subtract: ['$acknowledged', '$created_at'] },
              null,
            ],
          },
        },
      },
    },
  ]);
};

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);