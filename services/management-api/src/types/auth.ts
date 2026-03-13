import type { Request } from "express";

import type { ManagementTokenPayload } from "@rotavans/shared";

export interface AdminRequest extends Request {
  admin: ManagementTokenPayload;
}
