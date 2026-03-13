import request from "supertest";

import { createApp } from "../app";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("management-api");
  });
});
