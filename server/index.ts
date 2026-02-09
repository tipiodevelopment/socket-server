import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { detectAndCacheBaseUrl } from "./utils";
import { startScheduler } from "./scheduler";
import { initializeWorkers } from "./queue/workers";
import { isQueueEnabled } from "./queue/queues";

const app = express();

// Enable CORS for iOS/external API access
app.use(cors({
  origin: '*', // Allow all origins (you can restrict this in production)
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

(async () => {
  try {
    // Check required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
      console.error('Please configure these in your deployment settings:');
      console.error('  - DATABASE_URL: PostgreSQL connection string');
      console.error('  - SESSION_SECRET: Random secret for session encryption');
      process.exit(1);
    }

    console.log('✅ Environment variables verified (DATABASE_URL, SESSION_SECRET)');
    
    // Detect and cache the base URL at startup for URL normalization
    detectAndCacheBaseUrl();
    
    const server = await registerRoutes(app);
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

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
      console.log('✅ Vite dev server setup complete');
    } else {
      serveStatic(app);
      console.log('✅ Static files served for production');
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      console.log('✅ Application started successfully');
    });
  } catch (error) {
    console.error('❌ Fatal error during application startup:');
    console.error(error);
    
    // Log stack trace for debugging
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    // Exit with error code
    process.exit(1);
  }
})();
