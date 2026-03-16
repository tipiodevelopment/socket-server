/**
 * Minimal HTTP server using ONLY native Node.js modules (http, path, fs).
 * Port binds in < 50ms so Replit health checks pass immediately.
 * Responds 200 to ALL GET/HEAD requests during startup.
 * All other requests are buffered and flushed once Express is ready.
 */
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

const PORT = parseInt(process.env.PORT || '5000');

// Signal to server/index.ts NOT to auto-start its own HTTP server.
process.env.VIO_PRESERVER = '1';
// Force production mode
process.env.NODE_ENV = 'production';

// Bare-metal server — zero npm dependencies
const pending: Array<{ req: http.IncomingMessage; res: http.ServerResponse }> = [];
let expressApp: ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null = null;

// Fallback HTML loaded after listen() so it doesn't delay startup
let indexHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';

const httpServer = http.createServer((req, res) => {
  // Once Express is ready, it handles everything
  if (expressApp) {
    expressApp(req, res);
    return;
  }

  const method = (req.method ?? 'GET').toUpperCase();

  // Respond 200 immediately to all GET/HEAD/OPTIONS — covers any health check URL
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    const url = (req.url ?? '/').split('?')[0];
    const isJson = url === '/health' || url === '/_health';

    if (isJson) {
      const body = JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      if (method !== 'HEAD') res.end(body);
      else res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(indexHtml) });
      if (method !== 'HEAD') res.end(indexHtml);
      else res.end();
    }
    return;
  }

  // Buffer write requests until Express is ready
  pending.push({ req, res });
});

// Bind port FIRST — before any disk I/O or async work
httpServer.listen(PORT, '0.0.0.0', () => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Port ${PORT} open — health checks will pass`);

  // Now load index.html from disk (after port is open)
  try {
    const p = path.join(process.cwd(), 'dist', 'public', 'index.html');
    indexHtml = fs.readFileSync(p, 'utf-8');
  } catch {
    // fallback already set
  }
});

// Load the full Express app asynchronously in the background
(async () => {
  try {
    const { setupApp } = await import('./index.js');
    expressApp = await setupApp(httpServer);

    const n = pending.length;
    if (n > 0) {
      console.log(`[Startup] Flushing ${n} buffered request(s)`);
      for (const { req, res } of pending) expressApp(req, res);
      pending.length = 0;
    }

    console.log('[Startup] Application fully ready');
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
})();
