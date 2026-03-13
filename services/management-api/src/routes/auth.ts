import { Router } from "express";

import { getFirebaseAdmin } from "../lib/firebase";
import { signManagementToken } from "../lib/jwt";

const router = Router();

router.post("/login", async (req, res) => {
  const { firebase_id_token } = req.body as { firebase_id_token?: string };

  if (!firebase_id_token) {
    return res.status(400).json({ error: "firebase_id_token is required" });
  }

  try {
    const decoded = await getFirebaseAdmin().auth().verifyIdToken(firebase_id_token);
    const token = signManagementToken({
      sub: decoded.uid,
      role: "superadmin"
    });

    return res.json({
      token,
      role: "superadmin",
      firebase_uid: decoded.uid
    });
  } catch {
    return res.status(401).json({ error: "Token Firebase invalido" });
  }
});

router.post("/dev-login", async (_req, res) => {
  if (process.env.DEV_AUTH_ENABLED !== "true") {
    return res.status(404).json({ error: "Rota indisponivel" });
  }

  const token = signManagementToken({
    sub: "dev-superadmin",
    role: "superadmin"
  });

  return res.json({
    token,
    role: "superadmin",
    firebase_uid: "dev-superadmin"
  });
});

export default router;
