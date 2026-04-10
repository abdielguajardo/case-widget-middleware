import test from "node:test";
import assert from "node:assert/strict";
import { buildRequestLogContext, getErrorMessage } from "../lib/logging";

test("buildRequestLogContext extracts request id and first forwarded ip", () => {
  const context = buildRequestLogContext(
    {
      method: "POST",
      url: "/api/submit",
      headers: {
        origin: "https://example.com",
        "x-request-id": "req-123",
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      },
    } as never,
    "/api/submit",
    { origin: "https://example.com", domain: "example.com" }
  );

  assert.deepEqual(context, {
    requestId: "req-123",
    method: "POST",
    route: "/api/submit",
    path: "/api/submit",
    origin: "https://example.com",
    domain: "example.com",
    clientIp: "203.0.113.9",
  });
});

test("getErrorMessage normalizes unknown errors", () => {
  assert.equal(getErrorMessage(new Error("boom")), "boom");
  assert.equal(getErrorMessage("bad"), "Unknown error");
});
