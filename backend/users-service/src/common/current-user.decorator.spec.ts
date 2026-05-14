import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { currentUserIdFactory } from './current-user.decorator';

const makeCtx = (headers: Record<string, any>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('currentUserIdFactory', () => {
  it('returns the x-user-id header value when present', () => {
    const result = currentUserIdFactory(
      undefined,
      makeCtx({ 'x-user-id': 'u-1' }),
    );
    expect(result).toBe('u-1');
  });

  it('throws UnauthorizedException when the header is missing', () => {
    expect(() =>
      currentUserIdFactory(undefined, makeCtx({})),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the header is not a string', () => {
    expect(() =>
      currentUserIdFactory(undefined, makeCtx({ 'x-user-id': ['u-1'] })),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the header is an empty string', () => {
    expect(() =>
      currentUserIdFactory(undefined, makeCtx({ 'x-user-id': '' })),
    ).toThrow(UnauthorizedException);
  });
});
