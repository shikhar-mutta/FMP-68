import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

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
