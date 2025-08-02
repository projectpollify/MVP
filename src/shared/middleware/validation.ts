import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

interface ValidationSchema {
  body?: any;
  query?: any;
  params?: any;
}

export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationOptions = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true
    };

    if (schema.body) {
      const { error, value } = Joi.object(schema.body).validate(req.body, validationOptions);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => detail.message)
        });
      }
      req.body = value;
    }

    if (schema.query) {
      const { error, value } = Joi.object(schema.query).validate(req.query, validationOptions);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => detail.message)
        });
      }
      req.query = value;
    }

    if (schema.params) {
      const { error, value } = Joi.object(schema.params).validate(req.params, validationOptions);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => detail.message)
        });
      }
      req.params = value;
    }

    next();
  };
}
