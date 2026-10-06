import test from "node:test";
import assert from "node:assert/strict";
import http from "../convex/http.js";
import { MAX_PCM_BYTES, UNREADABLE } from "../convex/lib/rules.js";

const routes = new Map(
  http.getRoutes().map(([path, _method, handler]) => [path, handler._handler]),
);
const token = "synthetic-bridge-token";
const request = (route, body, headers = {}) =>
  new Request(`https://synthetic.convex.site${route}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });
test("both actual registered endpoints reject missing authentication before any database or AI access", async () => {
  const before = process.env.PRACTICE_BRIDGE_TOKEN;
  process.env.PRACTICE_BRIDGE_TOKEN = token;
  try {
    for (const [path, handler] of routes) {
      const response = await handler(
        {},
        new Request(`https://synthetic.convex.site${path}`, { method: "POST" }),
      );
      assert.equal(response.status, 401);
    }
  } finally {
    before === undefined
      ? delete process.env.PRACTICE_BRIDGE_TOKEN
      : (process.env.PRACTICE_BRIDGE_TOKEN = before);
  }
});
test("prepare validates identity before calling the mutation", async () => {
  const before = process.env.PRACTICE_BRIDGE_TOKEN;
  process.env.PRACTICE_BRIDGE_TOKEN = token;
  try {
    const response = await routes.get("/practice/prepare")(
      {},
      request(
        "/practice/prepare",
        JSON.stringify({ phone: "not-a-phone", messageId: "FAKE", text: "1" }),
      ),
    );
    assert.equal(response.status, 400);
  } finally {
    before === undefined
      ? delete process.env.PRACTICE_BRIDGE_TOKEN
      : (process.env.PRACTICE_BRIDGE_TOKEN = before);
  }
});
test("overlong PCM is rejected in Convex before the AI action and finishes the delivery", async () => {
  const before = process.env.PRACTICE_BRIDGE_TOKEN;
  process.env.PRACTICE_BRIDGE_TOKEN = token;
  let finished = false;
  try {
    const ctx = {
      runAction: () => assert.fail("overlong audio must not invoke AI"),
      runMutation: async (_ref, args) => {
        finished = true;
        assert.equal(args.score, null);
        assert.deepEqual(args.messages, [UNREADABLE]);
      },
    };
    const response = await routes.get("/practice/score")(
      ctx,
      request("/practice/score", Buffer.alloc(MAX_PCM_BYTES + 2), {
        "Content-Type": "application/octet-stream",
        "X-Practice-Phone": "15555550123",
        "X-Practice-Message": "FAKE",
      }),
    );
    assert.equal(response.status, 413);
    assert.equal(finished, true);
  } finally {
    before === undefined
      ? delete process.env.PRACTICE_BRIDGE_TOKEN
      : (process.env.PRACTICE_BRIDGE_TOKEN = before);
  }
});
test("actual endpoint forwards original PCM without storing it and clears its buffer afterwards", async () => {
  const before = process.env.PRACTICE_BRIDGE_TOKEN;
  process.env.PRACTICE_BRIDGE_TOKEN = token;
  let forwarded;
  try {
    const ctx = {
      runAction: async (_ref, args) => {
        forwarded = new Uint8Array(args.audio);
        assert.equal(forwarded.length, 4800);
        assert.equal(forwarded[0], 37);
        return ["synthetic score", "synthetic rewrite"];
      },
    };
    const response = await routes.get("/practice/score")(
      ctx,
      request("/practice/score", Buffer.alloc(4800, 37), {
        "Content-Type": "application/octet-stream",
        "X-Practice-Phone": "15555550123",
        "X-Practice-Message": "FAKE",
      }),
    );
    assert.deepEqual(await response.json(), {
      messages: ["synthetic score", "synthetic rewrite"],
    });
    assert.equal(
      forwarded.every((value) => value === 0),
      true,
    );
  } finally {
    before === undefined
      ? delete process.env.PRACTICE_BRIDGE_TOKEN
      : (process.env.PRACTICE_BRIDGE_TOKEN = before);
  }
});
