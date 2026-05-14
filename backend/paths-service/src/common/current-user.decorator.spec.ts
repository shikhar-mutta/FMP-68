import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { currentUserIdFactory } from './current-user.decorator';

const makeCtx = (headers: Record<string, any>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('currentUserIdFactory (paths-service)', () => {
  it('returns x-user-id when present', () => {
    expect(
      currentUserIdFactory(undefined, makeCtx({ 'x-user-id': 'u-1' })),
    ).toBe('u-1');
  });

  it('throws UnauthorizedException when missing', () => {
    expect(() =>
      currentUserIdFactory(undefined, makeCtx({})),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when not a string', () => {
    expect(() =>
      currentUserIdFactory(undefined, makeCtx({ 'x-user-id': 1 as any })),
    ).toThrow(UnauthorizedException);
  });
});
