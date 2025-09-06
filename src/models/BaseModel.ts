import mongoose, { Document, Schema } from 'mongoose';
import { logger } from '../utils/logger';

export interface IBaseModel extends Document {
  created_at: Date;
  updated_at?: Date;
}

export abstract class BaseModel {
  public static addCommonFields(schema: Schema): void {
    // Add common timestamps if not already present
    if (!schema.paths.created_at) {
      schema.add({
        created_at: {
          type: Date,
          default: Date.now,
          immutable: true,
        },
      });
    }

    if (!schema.paths.updated_at) {
      schema.add({
        updated_at: {
          type: Date,
        },
      });
    }

    // Add pre-save middleware to update updated_at
    schema.pre('save', function(next) {
      if (this.isModified() && !this.isNew) {
        this.updated_at = new Date();
      }
      next();
    });

    // Add pre-update middleware
    schema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function() {
      this.set({ updated_at: new Date() });
    });
  }

  public static addAuditLogging(schema: Schema, modelName: string): void {
    // Log document creation
    schema.post('save', function(doc) {
      if (doc.isNew) {
        logger.info(`${modelName} created`, {
          modelName,
          documentId: doc._id,
          action: 'create',
        });
      } else {
        logger.info(`${modelName} updated`, {
          modelName,
          documentId: doc._id,
          action: 'update',
        });
      }
    });

    // Log document deletion
    schema.post(['deleteOne', 'findOneAndDelete', 'deleteMany'], function(result) {
      logger.info(`${modelName} deleted`, {
        modelName,
        action: 'delete',
        deletedCount: result.deletedCount || 1,
      });
    });
  }

  public static addValidationErrorHandling(schema: Schema): void {
    schema.post('save', function(error: any, doc: any, next: any) {
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => ({
          field: err.path,
          message: err.message,
          value: err.value,
        }));

        logger.warn('Validation error occurred', {
          documentId: doc?._id,
          errors: validationErrors,
        });
      }
      next(error);
    });
  }

  public static addIndexes(schema: Schema, indexes: Array<{ fields: Record<string, 1 | -1>; options?: any }>): void {
    indexes.forEach(({ fields, options = {} }) => {
      schema.index(fields, options);
    });
  }
}

// Common validation functions
export const validators = {
  email: {
    validator: (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
    message: 'Please enter a valid email address',
  },

  objectId: {
    validator: (id: any) => {
      return mongoose.Types.ObjectId.isValid(id);
    },
    message: 'Invalid ObjectId format',
  },

  nonEmptyString: {
    validator: (str: string) => {
      return typeof str === 'string' && str.trim().length > 0;
    },
    message: 'Field cannot be empty',
  },

  positiveNumber: {
    validator: (num: number) => {
      return typeof num === 'number' && num > 0;
    },
    message: 'Value must be a positive number',
  },

  arrayNotEmpty: {
    validator: (arr: any[]) => {
      return Array.isArray(arr) && arr.length > 0;
    },
    message: 'Array cannot be empty',
  },
};

// Common schema options
export const commonSchemaOptions = {
  timestamps: false, // We handle timestamps manually for more control
  versionKey: false,
  toJSON: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};