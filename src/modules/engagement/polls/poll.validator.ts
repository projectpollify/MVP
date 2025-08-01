import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

export class PollValidator {
  // Validation rules for creating a poll
  static createPoll = [
    body('postId')
      .isUUID()
      .withMessage('Invalid post ID format'),
    
    body('question')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Question must be between 10 and 500 characters'),
    
    body('options')
      .isArray({ min: 2, max: 6 })
      .withMessage('Poll must have between 2 and 6 options'),
    
    body('options.*')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Each option must be between 1 and 200 characters'),
    
    body('durationHours')
      .isIn([24, 72, 168])
      .withMessage('Duration must be 24, 72, or 168 hours'),
    
    this.handleValidationErrors
  ];

  // Validation for voting
  static vote = [
    param('id')
      .isUUID()
      .withMessage('Invalid poll ID format'),
    
    body('optionId')
      .isUUID()
      .withMessage('Invalid option ID format'),
    
    this.handleValidationErrors
  ];

  // Validation for getting a poll
  static getPoll = [
    param('id')
      .isUUID()
      .withMessage('Invalid poll ID format'),
    
    this.handleValidationErrors
  ];

  // Custom validation to check for duplicate options
  static checkDuplicateOptions = (req: Request, res: Response, next: NextFunction) => {
    if (req.body.options) {
      const options = req.body.options.map((opt: string) => opt.toLowerCase().trim());
      const uniqueOptions = new Set(options);
      
      if (uniqueOptions.size !== options.length) {
        return res.status(400).json({
          success: false,
          error: 'Poll options must be unique'
        });
      }
    }
    next();
  };

  // Handle validation errors
  private static handleValidationErrors(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    next();
  }
}
