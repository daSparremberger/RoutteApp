import type { NextFunction, Request, Response } from "express";

import { pool } from "../db/pool";
import { getRedis } from "../redis/client";
import { verifyAppToken } from "../lib/jwt";
import type { AppRequest } from "../types/auth";

export function requireAppAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token ausente" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAppToken(token);

  if (!payload) {
    res.status(401).json({ error: "Token invalido" });
    return;
  }

  const appReq = req as unknown as AppRequest;
  appReq.user = payload;
  appReq.tenantId = payload.tenant_id;
  next();
}

export async function requireTenantActive(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const appReq = req as unknown as AppRequest;
  const redis = getRedis();
  const key = `tenant:${appReq.tenantId}:active`;
  const cached = redis ? await redis.get(key) : null;

  if (cached === "false") {
    res.status(403).json({ error: "Tenant desativado" });
    return;
  }

  if (cached === "true") {
    next();
    return;
  }

  const result = await pool.query(
    `SELECT ativo FROM management.tenants WHERE id = $1`,
    [appReq.tenantId]
  );

  const isActive = Boolean(result.rows[0]?.ativo);
  if (redis) {
    await redis.set(key, String(isActive), "EX", 60);
  }

  if (!isActive) {
    res.status(403).json({ error: "Tenant desativado" });
    return;
  }

  next();
}

export function requireModule(slug: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const appReq = req as unknown as AppRequest;
    const redis = getRedis();
    const key = `module:${appReq.tenantId}:${slug}`;
    const cached = redis ? await redis.get(key) : null;

    if (cached === "false") {
      res.status(403).json({ error: "Modulo nao habilitado para este tenant" });
      return;
    }

    if (cached === "true") {
      next();
      return;
    }

    const result = await pool.query(
      `SELECT tm.habilitado
       FROM management.tenant_modules tm
       JOIN management.modules m ON m.id = tm.module_id
       WHERE tm.tenant_id = $1 AND m.slug = $2`,
      [appReq.tenantId, slug]
    );

    const enabled = Boolean(result.rows[0]?.habilitado);
    if (redis) {
      await redis.set(key, String(enabled), "EX", 300);
    }

    if (!enabled) {
      res.status(403).json({ error: "Modulo nao habilitado para este tenant" });
      return;
    }

    next();
  };
}
