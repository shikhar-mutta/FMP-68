// ─────────────────────────────────────────────────────────────────────
// CRA dev-server proxy — ONLINE WATCH MODE only.
//
// When `npm start` runs, CRA auto-loads src/setupProxy.js. In watch
// mode this file is bind-mounted into the container at /app/src/
// setupProxy.js (see docker-compose.online-watch.yml). It is NOT
// present in src/ on disk, so the production nginx build is unaffected.
//
// The dev server reverse-proxies backend REST + socket.io to the
// api-gateway container on fmp-net, so every request from the React
// bundle hits the same ngrok origin (single-tunnel architecture).
// ─────────────────────────────────────────────────────────────────────
const { createProxyMiddleware } = require('http-proxy-middleware');

const TARGET = process.env.BACKEND_PROXY_TARGET || 'http://api-gateway:4000';

module.exports = function (app) {
  // REST routes
  //
  // Express's `app.use(prefix, mw)` strips `prefix` from req.url before
  // the middleware runs, so http-proxy-middleware would forward
  // `/google/callback` instead of `/auth/google/callback`. pathRewrite
  // restores the prefix so api-gateway's `/auth` route matches. The
  // gateway itself uses the same trick in main.ts.
  ['/auth', '/users', '/paths', '/follow-requests', '/notifications'].forEach((prefix) => {
    app.use(
      prefix,
      createProxyMiddleware({
        target: TARGET,
        changeOrigin: true,
        pathRewrite: (path) => `${prefix}${path}`,
        logLevel: 'warn',
      })
    );
  });

  // socket.io tracking namespace — must enable WS upgrade + restore prefix
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: TARGET,
      changeOrigin: true,
      ws: true,
      pathRewrite: (path) => `/socket.io${path}`,
      logLevel: 'warn',
    })
  );
};
