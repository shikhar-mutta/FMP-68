import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Reads the authenticated user ID from the `x-user-id` header.
 * The API gateway sets this header after validating the JWT.
 * Throws 401 if the header is missing.
 */
export const currentUserIdFactory = (
  _data: unknown,
  ctx: ExecutionContext,
): string => {
  const req = ctx.switchToHttp().getRequest();
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') {
    throw new UnauthorizedException(
      'Missing x-user-id header (request must come through api-gateway)',
    );
  }
  return userId;
};

export const CurrentUserId = createParamDecorator(currentUserIdFactory);
