import { Router } from "express";

import { pool } from "../db/pool";
import { requireAppAuth, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive);

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token) {
    return res.status(400).json({ error: "token e obrigatorio" });
  }

  try {
    await pool.query(
      `INSERT INTO app.device_tokens (tenant_id, pessoa_id, token, platform)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pessoa_id, token)
       DO UPDATE SET platform = EXCLUDED.platform, atualizado_em = NOW()`,
      [appReq.tenantId, appReq.user.sub, token, platform ?? "web"]
    );

    res.status(201).json({ message: "Token registrado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { token } = req.body as { token?: string };

  if (!token) {
    return res.status(400).json({ error: "token e obrigatorio" });
  }

  try {
    await pool.query(`DELETE FROM app.device_tokens WHERE pessoa_id = $1 AND token = $2`, [
      appReq.user.sub,
      token
    ]);

    res.json({ message: "Token removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
