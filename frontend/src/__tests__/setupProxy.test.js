jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn((opts) => ({ _opts: opts })),
}));

const { createProxyMiddleware } = require('http-proxy-middleware');

function makeApp() {
  return { use: jest.fn() };
}

describe('setupProxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('registers all REST prefixes on the app', () => {
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    const prefixes = app.use.mock.calls.map((c) => c[0]);
    expect(prefixes).toEqual(
      expect.arrayContaining(['/auth', '/users', '/paths', '/follow-requests', '/socket.io'])
    );
  });

  it('registers exactly 5 middleware entries (4 REST + 1 socket.io)', () => {
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);
    expect(app.use).toHaveBeenCalledTimes(5);
  });

  it('passes changeOrigin:true to every REST proxy', () => {
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    const restCalls = app.use.mock.calls.filter(([prefix]) => prefix !== '/socket.io');
    restCalls.forEach(([, mw]) => {
      expect(mw._opts.changeOrigin).toBe(true);
    });
  });

  it('enables ws:true only for the socket.io entry', () => {
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    const socketCall = app.use.mock.calls.find(([prefix]) => prefix === '/socket.io');
    expect(socketCall[1]._opts.ws).toBe(true);

    const restCalls = app.use.mock.calls.filter(([prefix]) => prefix !== '/socket.io');
    restCalls.forEach(([, mw]) => {
      expect(mw._opts.ws).toBeUndefined();
    });
  });

  it('pathRewrite for REST prepends the route prefix', () => {
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    const authCall = app.use.mock.calls.find(([prefix]) => prefix === '/auth');
    const rewrite = authCall[1]._opts.pathRewrite;
    expect(rewrite('/google/callback')).toBe('/auth/google/callback');
  });

  it('pathRewrite for socket.io prepends /socket.io', () => {
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    const socketCall = app.use.mock.calls.find(([prefix]) => prefix === '/socket.io');
    const rewrite = socketCall[1]._opts.pathRewrite;
    expect(rewrite('/EIO=4')).toBe('/socket.io/EIO=4');
  });

  it('uses default target when BACKEND_PROXY_TARGET is not set', () => {
    delete process.env.BACKEND_PROXY_TARGET;
    jest.resetModules();
    jest.mock('http-proxy-middleware', () => ({
      createProxyMiddleware: jest.fn((opts) => ({ _opts: opts })),
    }));
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    app.use.mock.calls.forEach(([, mw]) => {
      expect(mw._opts.target).toBe('http://api-gateway:4000');
    });
  });

  it('uses BACKEND_PROXY_TARGET env var when set', () => {
    process.env.BACKEND_PROXY_TARGET = 'http://custom-backend:9000';
    jest.resetModules();
    jest.mock('http-proxy-middleware', () => ({
      createProxyMiddleware: jest.fn((opts) => ({ _opts: opts })),
    }));
    const setup = require('../setupProxy');
    const app = makeApp();
    setup(app);

    app.use.mock.calls.forEach(([, mw]) => {
      expect(mw._opts.target).toBe('http://custom-backend:9000');
    });

    delete process.env.BACKEND_PROXY_TARGET;
  });
});
