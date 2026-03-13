import jwt from "jsonwebtoken";

import type { AppTokenPayload } from "@rotavans/shared";

function getSecret() {
  const secret = process.env.APP_JWT_SECRET;

  if (!secret) {
    throw new Error("APP_JWT_SECRET is not set");
  }

  return secret;
}

export function signAppToken(payload: Omit<AppTokenPayload, "iat" | "exp">) {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyAppToken(token: string) {
  try {
    return jwt.verify(token, getSecret()) as unknown as AppTokenPayload;
  } catch {
    return null;
  }
}
