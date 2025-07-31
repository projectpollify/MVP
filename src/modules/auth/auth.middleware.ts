import { Request, Response, NextFunction } from 'express';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        wallet_address: string;
        mode: 'true' | 'shadow' | 'soul';
        session_id: string;
      };
    }
  }
}

/**
 * Main authentication middleware - placeholder for Module 2 implementation
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // TODO: Implement JWT verification
  // This is a placeholder that Module 2 will implement
  return res.status(401).json({
    success: false,
    error: 'NOT_IMPLEMENTED'
  });
};

/**
 * Middleware to check specific modes
 */
export const requireMode = (allowedModes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedModes.includes(req.user.mode)) {
      return res.status(403).json({
        success: false,
        error: 'MODE_NOT_ALLOWED'
      });
    }
    next();
  };
};

/**
 * Middleware for read-only endpoints (allows all modes)
 */
export const authenticateReadOnly = authenticate;

/**
 * Middleware for write endpoints (no soul mode)
 */
export const authenticateWrite = [
  authenticate,
  requireMode(['true', 'shadow'])
];
