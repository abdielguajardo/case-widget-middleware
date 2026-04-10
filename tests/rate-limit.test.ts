import test from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit } from "../lib/rate-limit";

class InMemoryCounterStore {
  readonly counts = new Map<string, number>();
  readonly expirations = new Map<string, number>();

  async incr(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    this.expirations.set(key, seconds);
  }
}

test("enforceRateLimit sets expiry on first request and allows within limit", async () => {
  const store = new InMemoryCounterStore();

  const result = await enforceRateLimit(store, "example.com", "203.0.113.9");

  assert.equal(result.allowed, true);
  assert.equal(result.count, 1);
  assert.equal(store.expirations.get("ratelimit:example.com:203.0.113.9"), 600);
});

test("enforceRateLimit blocks after default limit is exceeded", async () => {
  const store = new InMemoryCounterStore();
  let result = await enforceRateLimit(store, "example.com", "203.0.113.9");

  for (let index = 0; index < 10; index += 1) {
    result = await enforceRateLimit(store, "example.com", "203.0.113.9");
  }

  assert.equal(result.allowed, false);
  assert.equal(result.count, 11);
  assert.equal(result.limit, 10);
});
