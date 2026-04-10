import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain } from "../lib/domain";

test("normalizeDomain normalizes full URLs", () => {
  assert.equal(
    normalizeDomain(" HTTPS://Example.com:443/path?q=1 "),
    "example.com"
  );
});

test("normalizeDomain keeps subdomains and strips trailing dot", () => {
  assert.equal(normalizeDomain("www.EXAMPLE.com."), "www.example.com");
});

test("normalizeDomain rejects invalid input", () => {
  assert.equal(normalizeDomain("not a domain ???"), null);
});
