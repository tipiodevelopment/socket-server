/**
 * Minimal HTTP server using ONLY native Node.js modules (http, path, fs).
 * Starts listening in < 100ms — long before Replit's health check fires.
 * Handles /health, /_health and / immediately from memory.
 * All other requests are buffered, then flushed once the full Express app loads.
 */
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

const PORT = parseInt(process.env.PORT || '5000');
const startMs = Date.now();

// Cache index.html in memory for instant GET / responses
let indexHtml = '<!DOCTYPE html><html><head></head><body></body></html>';
try {
  const p = path.join(process.cwd(), 'dist', 'public', 'index.html');
  indexHtml = fs.readFileSync(p, 'utf-8');
  console.log(`[Startup] index.html cached (${indexHtml.length} bytes)`);
} catch {
  console.warn('[Startup] dist/public/index.html not found, using fallback');
}

// Request queue — filled before Express is ready, flushed once it loads
type Pending = { req: http.IncomingMessage; res: http.ServerResponse };
const pending: Pending[] = [];
let expressApp: ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null = null;

// Bare-metal HTTP server — zero external dependencies
const httpServer = http.createServer((req, res) => {
  // Delegate to Express once ready
  if (expressApp) {
    expressApp(req, res);
    return;
  }

  const url = (req.url ?? '/').split('?')[0];

  // Health check endpoints — always instant 200
  if (url === '/health' || url === '/_health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Root — serves index.html from memory (Replit health check target)
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
    return;
  }

  // Buffer everything else until Express takes over
  pending.push({ req, res });
});

// Start listening — no external packages needed, happens in < 100ms
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Startup] Port ${PORT} open in ${Date.now() - startMs}ms`);
});

// Now load the full Express application asynchronously
(async () => {
  try {
    const { setupApp } = await import('./index.js');
    expressApp = await setupApp(httpServer);

    const elapsed = Date.now() - startMs;
    console.log(`[Startup] Full app ready in ${elapsed}ms — flushing ${pending.length} buffered request(s)`);

    for (const { req, res } of pending) {
      expressApp(req, res);
    }
    pending.length = 0;
  } catch (err) {
    console.error('[Startup] Fatal: failed to load application:', err);
    process.exit(1);
  }
})();
