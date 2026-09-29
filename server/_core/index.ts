import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { issueCsrfToken } from "./auth";
import { ENV } from "./env";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", ENV.trustProxy ? 1 : false);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
    });
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.get("/healthz", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) return res.status(503).json({ ok: false, database: "not configured" });
      await db.execute(sql`SELECT 1`);
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ ok: false, database: "unavailable" });
    }
  });
  registerStorageProxy(app);
  app.get("/api/auth/csrf", async (req, res) => {
    try {
      await issueCsrfToken(req, res);
      res.set("Cache-Control", "no-store").status(204).end();
    } catch (error) {
      console.error("[Auth] CSRF token issue failed", error);
      res.status(503).json({ error: "Authentication service unavailable" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.argv.includes("--dev")) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const development = process.argv.includes("--dev");
  const port = development ? await findAvailablePort(preferredPort) : preferredPort;

  if (development && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
