import type { Express, Request, Response } from "express";
import { authenticateRequest } from "./auth";
import { normalizeStorageKey, storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  const handler = async (req: Request, res: Response) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth.user) return res.status(401).send("Authentication required");
      const raw = (req.params as Record<string, string>)[0];
      const key = normalizeStorageKey(decodeURIComponent(raw ?? ""));
      res.set("Cache-Control", "private, no-store");
      return res.redirect(307, await storageGetSignedUrl(key));
    } catch {
      console.error("[Storage] Signed download failed");
      return res.status(404).send("Object not found");
    }
  };
  app.get("/storage/*", handler);
  // Temporary read-only compatibility path for asset URLs persisted before cutover.
  app.get("/manus-storage/*", handler);
}
