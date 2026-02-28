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

// Health check — responds immediately, even before full initialization
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

// Create HTTP server and start listening immediately so health checks pass
const port = parseInt(process.env.PORT || '5000', 10);
const httpServer = createServer(app);

httpServer.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);
});

// Async initialization — routes, WebSocket, scheduler, static files
(async () => {
  try {
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
      process.exit(1);
    }

    console.log('✅ Environment variables verified (DATABASE_URL, SESSION_SECRET)');

    detectAndCacheBaseUrl();

    // Pass the already-listening server so registerRoutes attaches WebSocket to it
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

    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
      console.log('✅ Vite dev server setup complete');
    } else {
      serveStatic(app);
      console.log('✅ Static files served for production');
    }

    console.log('✅ Application started successfully');
  } catch (error) {
    console.error('❌ Fatal error during application startup:');
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
})();
