import type { Request } from "express";

import type { AppTokenPayload } from "@rotavans/shared";

export interface AppRequest extends Request {
  user: AppTokenPayload;
  tenantId: number;
}
