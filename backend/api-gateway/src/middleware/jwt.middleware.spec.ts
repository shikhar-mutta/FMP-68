import * as jwt from 'jsonwebtoken';
import { buildJwtMiddleware, __testables } from './jwt.middleware';

const { extractBearerToken } = __testables;

const SECRET = 'test-secret';

const callMiddleware = (
  headers: Record<string, any>,
): { req: any; nextCalled: boolean } => {
  const req = { headers };
  const res = {};
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  buildJwtMiddleware(SECRET)(req as any, res as any, next);
  return { req, nextCalled };
};

describe('buildJwtMiddleware', () => {
  it('stamps x-user-id from a valid Bearer JWT', () => {
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, SECRET);
    const { req, nextCalled } = callMiddleware({
      authorization: `Bearer ${token}`,
    });
    expect(req.headers['x-user-id']).toBe('user-1');
    expect(nextCalled).toBe(true);
  });

  it('coerces a numeric sub to a string', () => {
    const token = jwt.sign({ sub: 42 } as any, SECRET, {
      noTimestamp: true,
    });
    const { req } = callMiddleware({ authorization: `Bearer ${token}` });
    expect(req.headers['x-user-id']).toBe('42');
  });

  it('strips x-user-id when the token is invalid', () => {
    const { req } = callMiddleware({
      authorization: 'Bearer not.a.real.jwt',
      'x-user-id': 'attacker-claimed',
    });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('strips x-user-id when the token is signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'wrong-secret');
    const { req } = callMiddleware({
      authorization: `Bearer ${token}`,
      'x-user-id': 'attacker-claimed',
    });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('strips any client-supplied x-user-id when no Authorization header is present', () => {
    const { req } = callMiddleware({ 'x-user-id': 'attacker-claimed' });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('strips x-user-id when the Authorization scheme is not Bearer', () => {
    const { req } = callMiddleware({
      authorization: 'Basic abc',
      'x-user-id': 'attacker-claimed',
    });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('strips x-user-id when the JWT has no sub claim', () => {
    const token = jwt.sign({ email: 'a@b.com' }, SECRET);
    const { req } = callMiddleware({
      authorization: `Bearer ${token}`,
      'x-user-id': 'attacker-claimed',
    });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('calls next() exactly once per request', () => {
    const next = jest.fn();
    buildJwtMiddleware(SECRET)({ headers: {} } as any, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('strips x-user-id when the Authorization header is not a string (e.g. duplicate header)', () => {
    const { req } = callMiddleware({
      authorization: ['Bearer x', 'Bearer y'] as any,
      'x-user-id': 'attacker-claimed',
    });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('does not stamp x-user-id when verification succeeds with an empty payload', () => {
    const token = jwt.sign({}, SECRET);
    const { req } = callMiddleware({
      authorization: `Bearer ${token}`,
      'x-user-id': 'attacker-claimed',
    });
    expect(req.headers['x-user-id']).toBeUndefined();
  });

  describe('extractBearerToken', () => {
    it('returns null for non-string headers', () => {
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken(['Bearer a'])).toBeNull();
      expect(extractBearerToken(42)).toBeNull();
    });

    it('returns null when the prefix is wrong', () => {
      expect(extractBearerToken('Basic xyz')).toBeNull();
      expect(extractBearerToken('Bearer')).toBeNull();
    });

    it('returns null when token is empty after the prefix', () => {
      expect(extractBearerToken('Bearer ')).toBeNull();
    });

    it('returns the raw token when properly formed', () => {
      expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });
  });
});
