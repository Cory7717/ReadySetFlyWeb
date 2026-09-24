import type { RequestHandler } from "express";

/**
 * Terminal boundary for the API namespace. Mount this only after every real
 * API route so unknown API requests cannot be served by the SPA fallback.
 */
export const apiNotFound: RequestHandler = (_req, res) => {
  return res.status(404).json({ error: "API route not found" });
};
