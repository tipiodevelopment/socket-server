import express, { type Request, Response, NextFunction } from "express";
import type * as httpTypes from "http";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { detectAndCacheBaseUrl } from "./utils";
import { startScheduler } from "./scheduler";
import { initializeWorkers } from "./queue/workers";
import { isQueueEnabled } from "./queue/queues";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
<<<<<<< HEAD
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));
=======
>>>>>>> main

const isProduction = process.env.NODE_ENV !== 'development';

/**
 * Configures and returns the Express application on an existing HTTP server.
 * Called by preserver.ts (production fast-start) or directly in dev mode.
 */
export async function setupApp(
  server: httpTypes.Server
): Promise<(req: httpTypes.IncomingMessage, res: httpTypes.ServerResponse) => void> {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false,
  }));

  app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: false }));

  // Health endpoints — also handled by preserver before express is ready
  app.get('/health', (_req, res) =>
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
  );
  app.get('/_health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on('finish', () => {
      if (reqPath.startsWith('/api')) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${Date.now() - start}ms`;
        if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        if (logLine.length > 80) logLine = logLine.slice(0, 79) + '…';
        log(logLine);
      }
    });
    next();
  });

  const missingEnv = ['DATABASE_URL', 'SESSION_SECRET'].filter(v => !process.env[v]);
  if (missingEnv.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
  console.log('✅ Environment variables verified');

  detectAndCacheBaseUrl();

<<<<<<< HEAD
  const server = await registerRoutes(app);

  // Start the scheduler for automatic component activation/deactivation
=======
  await registerRoutes(app, server);
  console.log('✅ Routes registered');

>>>>>>> main
  startScheduler();
  console.log('✅ Scheduler started');

  if (isQueueEnabled()) {
    initializeWorkers();
    console.log('✅ Queue workers initialized');
  } else {
    console.log('ℹ️ Queue disabled');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || 'Internal Server Error' });
  });

  if (!isProduction) {
    await setupVite(app, server);
    console.log('✅ Vite dev server ready');
  } else {
    serveStatic(app);
    console.log('✅ Static files + SPA catch-all ready');
  }

<<<<<<< HEAD
  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
=======
  console.log('✅ Application fully initialized');
  return app;
}

// ── Auto-start when this file is the entry point ─────────────────────────────
// In production with preserver.ts: process.env.VIO_PRESERVER=1 is set before
// importing this module, so we skip the auto-start (preserver owns the server).
// In development (tsx server/index.ts) or without preserver: we start ourselves.
if (!process.env.VIO_PRESERVER) {
  (async () => {
    const { createServer } = await import('http');
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const port = parseInt(process.env.PORT || '5000');
    const server = createServer();

    server.on('error', (err: NodeJS.ErrnoException) => {
      console.error('❌ Server error:', err.code === 'EADDRINUSE'
        ? `Port ${port} already in use`
        : err.message);
      process.exit(1);
    });

    // In production: register GET / immediately so health checks pass while
    // the async setup below is still running (routes, drizzle, vite, etc.)
    if (isProduction) {
      let indexHtml = '';
      const indexPath = join(process.cwd(), 'dist', 'public', 'index.html');
      try {
        indexHtml = readFileSync(indexPath, 'utf-8');
        console.log(`[Startup] index.html cached (${indexHtml.length} bytes)`);
      } catch {
        console.warn('[Startup] index.html not found');
      }

      server.on('request', (req, res) => {
        const url = (req.url ?? '/').split('?')[0];
        if (url === '/health' || url === '/_health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
          return;
        }
        if (url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexHtml || '<!DOCTYPE html><html><body></body></html>');
          return;
        }
        // All other requests: allow express to handle them (once registered below)
      });
    }

    // Bind the port FIRST — health checks will pass from this moment
    server.listen(port, '0.0.0.0', () => {
      log(`serving on port ${port}`);
    });

    // Then complete the full async setup
    const app = await setupApp(server);

    // Replace the minimal handler with the full express handler
    server.removeAllListeners('request');
    server.on('request', app);
  })();
}
>>>>>>> main
