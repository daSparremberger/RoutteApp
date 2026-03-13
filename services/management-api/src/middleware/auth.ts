import type { NextFunction, Request, Response } from "express";

import { verifyManagementToken } from "../lib/jwt";
import type { AdminRequest } from "../types/auth";

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token ausente" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyManagementToken(token);

  if (!payload || payload.role !== "superadmin") {
    res.status(401).json({ error: "Token invalido" });
    return;
  }

  (req as AdminRequest).admin = payload;
  next();
}
