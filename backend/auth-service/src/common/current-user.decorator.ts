import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Reads the authenticated user ID from the `x-user-id` header set by the api-gateway
 * after JWT validation. Throws 401 if missing.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'];
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException(
        'Missing x-user-id header (request must come through api-gateway)',
      );
    }
    return userId;
  },
);
