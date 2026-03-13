import jwt from "jsonwebtoken";

import type { ManagementTokenPayload } from "@rotavans/shared";

function getSecret() {
  const secret = process.env.MANAGEMENT_JWT_SECRET;

  if (!secret) {
    throw new Error("MANAGEMENT_JWT_SECRET is not set");
  }

  return secret;
}

export function signManagementToken(
  payload: Omit<ManagementTokenPayload, "iat" | "exp">
) {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyManagementToken(token: string) {
  try {
    return jwt.verify(token, getSecret()) as ManagementTokenPayload;
  } catch {
    return null;
  }
}
