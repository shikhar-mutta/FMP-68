import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';

const BEARER_PREFIX = 'Bearer ';

const extractBearerToken = (header: unknown): string | null => {
  if (typeof header !== 'string') return null;
  if (!header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length);
  return token.length > 0 ? token : null;
};

export const buildJwtMiddleware = (secret: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req.headers['authorization']);
    if (token === null) {
      delete req.headers['x-user-id'];
      next();
      return;
    }
    try {
      const payload = verify(token, secret) as { sub?: string | number };
      if (payload.sub !== undefined && payload.sub !== null) {
        req.headers['x-user-id'] = String(payload.sub);
      } else {
        delete req.headers['x-user-id'];
      }
    } catch {
      delete req.headers['x-user-id'];
    }
    next();
  };
};

export const __testables = { extractBearerToken };
