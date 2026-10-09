import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePractice } from "../convex/lib/evaluation.js";
import { emptyFacts } from "../convex/lib/facts.js";

const valid = {
  unreadable: false,
  facts: { payRequest: "10%", agreedGoals: "Finish by Friday", deliveredOutcome: "Finished by Friday", expectations: "Met expectations" },
  clarity: 80, confidence: 70, persuasion: 75, warmth: 85,
  rewrite: "A synthetic raise request using the supplied facts.",
};

test("malformed facts, scores or rewrite retry once before returning a validated result", async () => {
  for (const bad of [{ ...valid, facts: [] }, { ...valid, confidence: null }, { ...valid, rewrite: null }, { ...valid, rewrite: "*Synthetic answer*" }]) {
    let calls = 0;
    let reservations = 0;
    const logs = [];
    const result = await evaluatePractice({
      evaluate: async () => JSON.stringify(++calls === 1 ? bad : valid),
      reserveRetry: async () => { reservations++; return true; },
      facts: emptyFacts(),
      report: (error) => logs.push(error.message),
    });
    assert.equal(result.score.overall, 78);
    assert.equal(calls, 2);
    assert.equal(reservations, 1);
    assert.equal(logs.length, 1);
  }
});

test("a second malformed result is rejected without a third paid call", async () => {
  let calls = 0;
  await assert.rejects(evaluatePractice({ evaluate: async () => { calls++; return JSON.stringify({ ...valid, rewrite: null }); }, reserveRetry: async () => true, facts: emptyFacts(), report: () => {} }), /invalid_rewrite/);
  assert.equal(calls, 2);
});

test("both rejected response texts are recorded before the final failure", async () => {
  const raw = JSON.stringify({ ...valid, confidence: null });
  const texts = [];
  await assert.rejects(evaluatePractice({ evaluate: async () => raw, reserveRetry: async () => true, facts: emptyFacts(), report: () => {}, reportRejected: (text) => texts.push(text) }), /invalid_scores/);
  assert.deepEqual(texts, [raw, raw]);
});

test("an exhausted quota blocks the retry before any second AI call", async () => {
  let calls = 0;
  await assert.rejects(evaluatePractice({ evaluate: async () => { calls++; return JSON.stringify({ ...valid, confidence: null }); }, reserveRetry: async () => false, facts: emptyFacts(), report: () => {} }), /call_limit_reached/);
  assert.equal(calls, 1);
});

test("success, missing facts, unreadable audio and provider failures do not trigger retries", async () => {
  const reserveRetry = async () => assert.fail("Unexpected paid retry");
  await evaluatePractice({ evaluate: async () => JSON.stringify(valid), reserveRetry, facts: emptyFacts() });
  assert.equal((await evaluatePractice({ evaluate: async () => '{"unreadable":false,"facts":{"payRequest":"10%"}}', reserveRetry, facts: emptyFacts() })).score, null);
  await assert.rejects(evaluatePractice({ evaluate: async () => '{"unreadable":true}', reserveRetry, facts: emptyFacts() }), /unreadable/);
  await assert.rejects(evaluatePractice({ evaluate: async () => { throw new Error("insufficient_quota"); }, reserveRetry, facts: emptyFacts() }), /insufficient_quota/);
});
