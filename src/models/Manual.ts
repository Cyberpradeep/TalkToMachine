import mongoose, { Schema, Document } from 'mongoose';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IManual extends Document {
  enterprise_id: mongoose.Types.ObjectId;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  uploaded_at: Date;
  updated_at?: Date;
  uploaded_by: mongoose.Types.ObjectId;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string;
  chunks_count?: number;
}

const manualSchema = new Schema<IManual>({
  enterprise_id: {
    type: Schema.Types.ObjectId,
    ref: 'Enterprise',
    required: [true, 'Enterprise ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true,
    minlength: [1, 'Filename cannot be empty'],
    maxlength: [255, 'Filename cannot exceed 255 characters'],
    validate: {
      validator: validators.nonEmptyString.validator,
      message: 'Filename cannot be empty or just whitespace',
    },
  },
  original_name: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    minlength: [1, 'Original filename cannot be empty'],
    maxlength: [255, 'Original filename cannot exceed 255 characters'],
    validate: {
      validator: validators.nonEmptyString.validator,
      message: 'Original filename cannot be empty or just whitespace',
    },
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be at least 1 byte'],
    max: [10 * 1024 * 1024, 'File size cannot exceed 10MB'],
    validate: {
      validator: function(size: number) {
        return Number.isInteger(size) && size > 0;
      },
      message: 'File size must be a positive integer',
    },
  },
  mime_type: {
    type: String,
    required: [true, 'MIME type is required'],
    enum: {
      values: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      message: 'Unsupported file type. Only PDF, DOC, and DOCX files are allowed',
    },
  },
  uploaded_at: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  uploaded_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  processing_status: {
    type: String,
    required: true,
    enum: {
      values: ['pending', 'processing', 'completed', 'failed'],
      message: 'Processing status must be one of: pending, processing, completed, failed',
    },
    default: 'pending',
  },
  processing_error: {
    type: String,
    trim: true,
    maxlength: [1000, 'Processing error message cannot exceed 1000 characters'],
  },
  chunks_count: {
    type: Number,
    min: [0, 'Chunks count cannot be negative'],
    validate: {
      validator: function(count: number) {
        return !count || (Number.isInteger(count) && count >= 0);
      },
      message: 'Chunks count must be a non-negative integer',
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(manualSchema);
BaseModel.addAuditLogging(manualSchema, 'Manual');
BaseModel.addValidationErrorHandling(manualSchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(manualSchema, [
  { fields: { enterprise_id: 1, uploaded_at: -1 } },
  { fields: { processing_status: 1, uploaded_at: -1 } },
  { fields: { uploaded_by: 1, uploaded_at: -1 } },
  { fields: { filename: 1 }, options: { unique: true } },
  { fields: { enterprise_id: 1, processing_status: 1 } },
]);

// Pre-save middleware for validation
manualSchema.pre('save', function(next) {
  // Validate processing_error is only set when status is 'failed'
  if (this.processing_status !== 'failed' && this.processing_error) {
    this.processing_error = undefined;
  }

  // Validate chunks_count is only set when status is 'completed'
  if (this.processing_status !== 'completed' && this.chunks_count !== undefined) {
    this.chunks_count = undefined;
  }

  // Ensure processing_error is set when status is 'failed'
  if (this.processing_status === 'failed' && !this.processing_error) {
    this.processing_error = 'Processing failed with unknown error';
  }

  next();
});

// Instance methods
manualSchema.methods.markAsProcessing = function(): void {
  this.processing_status = 'processing';
  this.processing_error = undefined;
};

manualSchema.methods.markAsCompleted = function(chunksCount: number): void {
  this.processing_status = 'completed';
  this.chunks_count = chunksCount;
  this.processing_error = undefined;
};

manualSchema.methods.markAsFailed = function(error: string): void {
  this.processing_status = 'failed';
  this.processing_error = error;
  this.chunks_count = undefined;
};

manualSchema.methods.isProcessed = function(): boolean {
  return this.processing_status === 'completed';
};

manualSchema.methods.canBeReprocessed = function(): boolean {
  return ['failed', 'completed'].includes(this.processing_status);
};

manualSchema.methods.getFileExtension = function(): string {
  const mimeTypeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  return mimeTypeMap[this.mime_type] || 'unknown';
};

manualSchema.methods.getSizeInMB = function(): number {
  return Math.round((this.size / (1024 * 1024)) * 100) / 100;
};

// Static methods
manualSchema.statics.findByEnterprise = function(enterpriseId: string | mongoose.Types.ObjectId, status?: string) {
  const query = this.find({ enterprise_id: enterpriseId });
  
  if (status) {
    query.where('processing_status').equals(status);
  }
  
  return query.sort({ uploaded_at: -1 }).populate('uploaded_by', 'email');
};

manualSchema.statics.findPendingProcessing = function() {
  return this.find({ processing_status: 'pending' })
    .sort({ uploaded_at: 1 })
    .populate('enterprise_id uploaded_by');
};

manualSchema.statics.getProcessingStats = function(enterpriseId?: string | mongoose.Types.ObjectId) {
  const matchStage = enterpriseId ? { enterprise_id: new mongoose.Types.ObjectId(enterpriseId.toString()) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$processing_status', 'pending'] }, 1, 0] } },
        processing: { $sum: { $cond: [{ $eq: ['$processing_status', 'processing'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$processing_status', 'completed'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$processing_status', 'failed'] }, 1, 0] } },
        total_size: { $sum: '$size' },
        total_chunks: { $sum: { $ifNull: ['$chunks_count', 0] } },
      },
    },
  ]);
};

export const Manual = mongoose.model<IManual>('Manual', manualSchema);