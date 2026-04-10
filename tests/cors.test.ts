import test from "node:test";
import assert from "node:assert/strict";
import { setCorsHeaders } from "../lib/cors";

class MockHeaders {
  private headers = new Map<string, string>();

  getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase());
  }

  setHeader(name: string, value: number | string | readonly string[]): void {
    const normalizedValue = Array.isArray(value) ? value.join(", ") : String(value);
    this.headers.set(name.toLowerCase(), normalizedValue);
  }
}

test("setCorsHeaders always sets Vary Origin and common headers", () => {
  const res = new MockHeaders();

  setCorsHeaders(res, "GET, OPTIONS");

  assert.equal(res.getHeader("vary"), "Origin");
  assert.equal(res.getHeader("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(res.getHeader("access-control-allow-headers"), "Content-Type");
  assert.equal(res.getHeader("access-control-allow-origin"), undefined);
});

test("setCorsHeaders appends Origin to existing Vary and reflects allowed origin", () => {
  const res = new MockHeaders();
  res.setHeader("Vary", "Accept-Encoding");

  setCorsHeaders(res, "POST, OPTIONS", "https://example.com");

  assert.equal(res.getHeader("vary"), "Accept-Encoding, Origin");
  assert.equal(
    res.getHeader("access-control-allow-origin"),
    "https://example.com"
  );
});
