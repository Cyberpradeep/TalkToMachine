import mongoose, { Schema, Document } from 'mongoose';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IChunk extends Document {
  manual_id: mongoose.Types.ObjectId;
  enterprise_id: mongoose.Types.ObjectId;
  text: string;
  order: number;
  metadata: {
    page_number?: number;
    section_title?: string;
    word_count: number;
    char_count: number;
    start_position?: number;
    end_position?: number;
  };
  created_at: Date;
  updated_at?: Date;
}

const chunkSchema = new Schema<IChunk>({
  manual_id: {
    type: Schema.Types.ObjectId,
    ref: 'Manual',
    required: [true, 'Manual ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  enterprise_id: {
    type: Schema.Types.ObjectId,
    ref: 'Enterprise',
    required: [true, 'Enterprise ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  text: {
    type: String,
    required: [true, 'Chunk text is required'],
    trim: true,
    minlength: [1, 'Chunk text cannot be empty'],
    maxlength: [2000, 'Chunk text cannot exceed 2000 characters'],
    validate: {
      validator: validators.nonEmptyString.validator,
      message: 'Chunk text cannot be empty or just whitespace',
    },
  },
  order: {
    type: Number,
    required: [true, 'Chunk order is required'],
    min: [0, 'Chunk order must be non-negative'],
    validate: {
      validator: function(order: number) {
        return Number.isInteger(order) && order >= 0;
      },
      message: 'Chunk order must be a non-negative integer',
    },
  },
  metadata: {
    page_number: {
      type: Number,
      min: [1, 'Page number must be at least 1'],
      validate: {
        validator: function(page: number) {
          return !page || (Number.isInteger(page) && page >= 1);
        },
        message: 'Page number must be a positive integer',
      },
    },
    section_title: {
      type: String,
      trim: true,
      maxlength: [200, 'Section title cannot exceed 200 characters'],
    },
    word_count: {
      type: Number,
      required: [true, 'Word count is required'],
      min: [0, 'Word count must be non-negative'],
      validate: {
        validator: function(count: number) {
          return Number.isInteger(count) && count >= 0;
        },
        message: 'Word count must be a non-negative integer',
      },
    },
    char_count: {
      type: Number,
      required: [true, 'Character count is required'],
      min: [0, 'Character count must be non-negative'],
      validate: {
        validator: function(count: number) {
          return Number.isInteger(count) && count >= 0;
        },
        message: 'Character count must be a non-negative integer',
      },
    },
    start_position: {
      type: Number,
      min: [0, 'Start position must be non-negative'],
      validate: {
        validator: function(pos: number) {
          return !pos || (Number.isInteger(pos) && pos >= 0);
        },
        message: 'Start position must be a non-negative integer',
      },
    },
    end_position: {
      type: Number,
      min: [0, 'End position must be non-negative'],
      validate: {
        validator: function(pos: number) {
          return !pos || (Number.isInteger(pos) && pos >= 0);
        },
        message: 'End position must be a non-negative integer',
      },
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(chunkSchema);
BaseModel.addAuditLogging(chunkSchema, 'Chunk');
BaseModel.addValidationErrorHandling(chunkSchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(chunkSchema, [
  { fields: { manual_id: 1, order: 1 }, options: { unique: true } },
  { fields: { enterprise_id: 1 } },
  { fields: { 'metadata.word_count': 1 } },
  { fields: { 'metadata.page_number': 1 } },
  { fields: { enterprise_id: 1, manual_id: 1 } },
]);

// Pre-save middleware for validation
chunkSchema.pre('save', function(next) {
  // Auto-calculate character count if not provided
  if (!this.metadata.char_count) {
    this.metadata.char_count = this.text.length;
  }

  // Auto-calculate word count if not provided
  if (!this.metadata.word_count) {
    this.metadata.word_count = this.text.split(/\s+/).filter(word => word.length > 0).length;
  }

  // Validate start_position < end_position if both are provided
  if (this.metadata.start_position !== undefined && this.metadata.end_position !== undefined) {
    if (this.metadata.start_position >= this.metadata.end_position) {
      return next(new Error('Start position must be less than end position'));
    }
  }

  next();
});

// Instance methods
chunkSchema.methods.getWordDensity = function(): number {
  return this.metadata.word_count / this.metadata.char_count;
};

chunkSchema.methods.isLongChunk = function(): boolean {
  return this.metadata.word_count > 200 || this.metadata.char_count > 1500;
};

chunkSchema.methods.getPreview = function(length: number = 100): string {
  return this.text.length > length ? this.text.substring(0, length) + '...' : this.text;
};

chunkSchema.methods.hasPageInfo = function(): boolean {
  return !!this.metadata.page_number;
};

chunkSchema.methods.hasPositionInfo = function(): boolean {
  return this.metadata.start_position !== undefined && this.metadata.end_position !== undefined;
};

// Static methods
chunkSchema.statics.findByManual = function(manualId: string | mongoose.Types.ObjectId) {
  return this.find({ manual_id: manualId })
    .sort({ order: 1 })
    .populate('manual_id', 'original_name filename');
};

chunkSchema.statics.findByEnterprise = function(enterpriseId: string | mongoose.Types.ObjectId, options: any = {}) {
  const query = this.find({ enterprise_id: enterpriseId });
  
  if (options.minWordCount) {
    query.where('metadata.word_count').gte(options.minWordCount);
  }
  
  if (options.maxWordCount) {
    query.where('metadata.word_count').lte(options.maxWordCount);
  }
  
  if (options.pageNumber) {
    query.where('metadata.page_number').equals(options.pageNumber);
  }
  
  return query.sort({ manual_id: 1, order: 1 }).populate('manual_id');
};

chunkSchema.statics.searchText = function(
  enterpriseId: string | mongoose.Types.ObjectId,
  searchTerm: string,
  options: any = {}
) {
  const query = this.find({
    enterprise_id: enterpriseId,
    text: { $regex: searchTerm, $options: 'i' },
  });
  
  if (options.manualId) {
    query.where('manual_id').equals(options.manualId);
  }
  
  return query.sort({ manual_id: 1, order: 1 }).populate('manual_id');
};

chunkSchema.statics.getChunkStats = function(enterpriseId?: string | mongoose.Types.ObjectId) {
  const matchStage = enterpriseId ? { enterprise_id: new mongoose.Types.ObjectId(enterpriseId.toString()) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total_chunks: { $sum: 1 },
        total_words: { $sum: '$metadata.word_count' },
        total_chars: { $sum: '$metadata.char_count' },
        avg_words_per_chunk: { $avg: '$metadata.word_count' },
        avg_chars_per_chunk: { $avg: '$metadata.char_count' },
        max_words: { $max: '$metadata.word_count' },
        min_words: { $min: '$metadata.word_count' },
        unique_manuals: { $addToSet: '$manual_id' },
      },
    },
    {
      $addFields: {
        unique_manuals_count: { $size: '$unique_manuals' },
      },
    },
    {
      $project: {
        unique_manuals: 0,
      },
    },
  ]);
};

export const Chunk = mongoose.model<IChunk>('Chunk', chunkSchema);