import mongoose, { Schema, Document } from 'mongoose';
import { BaseModel, validators, commonSchemaOptions } from './BaseModel';

export interface IVector extends Document {
  enterprise_id: mongoose.Types.ObjectId;
  chunk_id: mongoose.Types.ObjectId;
  embedding: number[];
  model_version: string;
  created_at: Date;
  updated_at?: Date;
  
  // Instance methods
  cosineSimilarity(otherEmbedding: number[]): number;
  getMagnitude(): number;
  isNormalized(tolerance?: number): boolean;
  normalize(): number[];
}

const vectorSchema = new Schema<IVector>({
  enterprise_id: {
    type: Schema.Types.ObjectId,
    ref: 'Enterprise',
    required: [true, 'Enterprise ID is required'],
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  chunk_id: {
    type: Schema.Types.ObjectId,
    ref: 'Chunk',
    required: [true, 'Chunk ID is required'],
    unique: true,
    validate: {
      validator: validators.objectId.validator,
      message: validators.objectId.message,
    },
  },
  embedding: {
    type: [Number],
    required: [true, 'Embedding vector is required'],
    validate: [
      {
        validator: function(arr: number[]) {
          return Array.isArray(arr) && arr.length === 384; // all-MiniLM-L6-v2 embedding dimension
        },
        message: 'Embedding must have exactly 384 dimensions',
      },
      {
        validator: function(arr: number[]) {
          return arr.every(val => typeof val === 'number' && !isNaN(val) && isFinite(val));
        },
        message: 'All embedding values must be valid finite numbers',
      },
      {
        validator: function(arr: number[]) {
          // Check if vector is normalized (magnitude should be close to 1)
          const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
          return magnitude > 0.1 && magnitude < 10; // Allow some tolerance
        },
        message: 'Embedding vector appears to be invalid (zero or extremely large magnitude)',
      },
    ],
  },
  model_version: {
    type: String,
    required: [true, 'Model version is required'],
    trim: true,
    default: 'all-MiniLM-L6-v2',
    validate: {
      validator: function(version: string) {
        const validVersions = ['all-MiniLM-L6-v2', 'all-mpnet-base-v2', 'all-distilroberta-v1'];
        return validVersions.includes(version);
      },
      message: 'Invalid model version. Supported versions: all-MiniLM-L6-v2, all-mpnet-base-v2, all-distilroberta-v1',
    },
  },
}, commonSchemaOptions);

// Add common functionality
BaseModel.addCommonFields(vectorSchema);
BaseModel.addAuditLogging(vectorSchema, 'Vector');
BaseModel.addValidationErrorHandling(vectorSchema);

// Add indexes for optimal query performance
BaseModel.addIndexes(vectorSchema, [
  { fields: { enterprise_id: 1 } },
  { fields: { chunk_id: 1 }, options: { unique: true } },
  { fields: { model_version: 1 } },
  { fields: { enterprise_id: 1, model_version: 1 } },
  { fields: { created_at: -1 } },
]);

// Pre-save middleware for validation
vectorSchema.pre('save', function(this: IVector, next) {
  // Ensure embedding is properly formatted
  if (this.embedding && this.embedding.length > 0) {
    // Round to reasonable precision to save space
    this.embedding = this.embedding.map((val: number) => Math.round(val * 1000000) / 1000000);
  }

  next();
});

// Instance methods
vectorSchema.methods.cosineSimilarity = function(otherEmbedding: number[]): number {
  if (!otherEmbedding || otherEmbedding.length !== this.embedding.length) {
    throw new Error('Invalid embedding for similarity calculation');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < this.embedding.length; i++) {
    dotProduct += this.embedding[i] * otherEmbedding[i];
    normA += this.embedding[i] * this.embedding[i];
    normB += otherEmbedding[i] * otherEmbedding[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

vectorSchema.methods.getMagnitude = function(): number {
  return Math.sqrt(this.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
};

vectorSchema.methods.isNormalized = function(tolerance: number = 0.01): boolean {
  const magnitude = this.getMagnitude();
  return Math.abs(magnitude - 1.0) <= tolerance;
};

vectorSchema.methods.normalize = function(): number[] {
  const magnitude = this.getMagnitude();
  if (magnitude === 0) {
    throw new Error('Cannot normalize zero vector');
  }
  return this.embedding.map((val: number) => val / magnitude);
};

// Static methods
vectorSchema.statics.findByEnterprise = function(enterpriseId: string | mongoose.Types.ObjectId) {
  return this.find({ enterprise_id: enterpriseId })
    .populate('chunk_id')
    .sort({ created_at: -1 });
};

vectorSchema.statics.findByModel = function(modelVersion: string, enterpriseId?: string | mongoose.Types.ObjectId) {
  const query = this.find({ model_version: modelVersion });
  
  if (enterpriseId) {
    query.where('enterprise_id').equals(enterpriseId);
  }
  
  return query.populate('chunk_id enterprise_id');
};

vectorSchema.statics.findSimilar = function(
  queryEmbedding: number[],
  enterpriseId: string | mongoose.Types.ObjectId,
  limit: number = 10,
  threshold: number = 0.5
) {
  // Note: This is a basic implementation. In production, you'd want to use
  // a proper vector database or MongoDB's vector search capabilities
  return this.find({ enterprise_id: enterpriseId })
    .populate('chunk_id')
    .then((vectors: any[]) => {
      const similarities = vectors.map(vector => ({
        vector,
        similarity: vector.cosineSimilarity(queryEmbedding),
      }));

      return similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => ({
          ...item.vector.toObject(),
          similarity: item.similarity,
        }));
    });
};

vectorSchema.statics.getVectorStats = function(enterpriseId?: string | mongoose.Types.ObjectId) {
  const matchStage = enterpriseId ? { enterprise_id: new mongoose.Types.ObjectId(enterpriseId.toString()) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$model_version',
        count: { $sum: 1 },
        avg_magnitude: {
          $avg: {
            $sqrt: {
              $sum: {
                $map: {
                  input: '$embedding',
                  as: 'val',
                  in: { $multiply: ['$$val', '$$val'] },
                },
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        total_vectors: { $sum: '$count' },
        models: {
          $push: {
            version: '$_id',
            count: '$count',
            avg_magnitude: '$avg_magnitude',
          },
        },
      },
    },
  ]);
};

// Define interface for static methods
interface IVectorModel extends mongoose.Model<IVector> {
  findByEnterprise(enterpriseId: string | mongoose.Types.ObjectId): Promise<IVector[]>;
  findByModel(modelVersion: string, enterpriseId?: string | mongoose.Types.ObjectId): Promise<IVector[]>;
  findSimilar(queryEmbedding: number[], enterpriseId: string | mongoose.Types.ObjectId, limit?: number, threshold?: number): Promise<any[]>;
  getVectorStats(enterpriseId?: string | mongoose.Types.ObjectId): Promise<any[]>;
}

export const Vector = mongoose.model<IVector, IVectorModel>('Vector', vectorSchema);