import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { detectAndCacheBaseUrl } from "./utils";
import { startScheduler } from "./scheduler";
import { initializeWorkers } from "./queue/workers";
import { isQueueEnabled } from "./queue/queues";

const app = express();
const isProduction = process.env.NODE_ENV !== 'development';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// ── Immediate health check endpoints ─────────────────────────────────────────
// Registered first so they always respond instantly, even before full init.
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/_health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ── Production root / static setup (synchronous, before listen) ───────────────
// In production the build already ran, so dist/public/index.html exists.
// We read it once into memory so GET / can respond INSTANTLY with no disk I/O.
// This is what Cloud Run / Replit health checks hit and must receive a 200.
if (isProduction) {
  const distPublic = path.join(process.cwd(), 'dist', 'public');
  const indexFile = path.join(distPublic, 'index.html');

  // Read index.html into memory synchronously once at startup
  let indexHtml: string | null = null;
  try {
    indexHtml = fs.readFileSync(indexFile, 'utf-8');
    console.log(`[Startup] index.html loaded from ${indexFile} (${indexHtml.length} bytes)`);
  } catch (e) {
    console.warn(`[Startup] Could not read ${indexFile}:`, e);
  }

  // GET / — serves from memory, zero disk I/O, instant 200 for health checks
  app.get('/', (_req, res) => {
    if (indexHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(indexHtml);
    }
    // Fallback if build artefact missing — still return 200
    return res.status(200).json({ status: 'ok' });
  });

  // Other static assets (CSS, JS, images) served from dist/public
  if (fs.existsSync(distPublic)) {
    app.use(express.static(distPublic));
  }
}

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// ── Start listening immediately ───────────────────────────────────────────────
// Server is bound BEFORE async init so health checks pass from the first request.
const port = parseInt(process.env.PORT || '5000', 10);
const httpServer = createServer(app);

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use. Is another server running?`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

httpServer.listen(port, '0.0.0.0', () => {
  log(`serving on port ${port}`);
});

// ── Async initialization: routes, WebSocket, scheduler, SPA catch-all ─────────
(async () => {
  try {
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingEnvVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
      process.exit(1);
    }
    console.log('✅ Environment variables verified (DATABASE_URL, SESSION_SECRET)');

    detectAndCacheBaseUrl();

    await registerRoutes(app, httpServer);
    console.log('✅ Routes registered successfully');

    startScheduler();
    console.log('✅ Scheduler started');

    if (isQueueEnabled()) {
      initializeWorkers();
      console.log('✅ Queue workers initialized');
    } else {
      console.log('ℹ️ Queue disabled (USE_QUEUE != true), using synchronous processing');
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error(`Error handler caught: ${status} - ${message}`);
    });

    if (!isProduction) {
      await setupVite(app, httpServer);
      console.log('✅ Vite dev server setup complete');
    } else {
      // serveStatic adds express.static again (harmless) + SPA catch-all for deep links
      serveStatic(app);
      console.log('✅ Static files + SPA catch-all ready');
    }

    console.log('✅ Application started successfully');
  } catch (error) {
    console.error('❌ Fatal error during application startup:', error);
    process.exit(1);
  }
})();
