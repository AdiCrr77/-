import test from "node:test";
import assert from "node:assert/strict";
import {
  parseScore,
  formatScore,
  validAudio,
  validIdentity,
  reserveCall,
  HOUR,
  MAX_PCM_BYTES,
  providerMessage,
  BUSY,
  PAUSED,
  UNREADABLE,
  COULDNT_SCORE,
} from "../convex/lib/rules.js";

const answer = {
  clarity: 71,
  confidence: 86,
  persuasion: 79,
  warmth: 90,
  rewrite: "I would like a 10% raise for the results I delivered.",
};
test("malformed scoring output reports structure only without exposing the response", () => {
  for (const [text, code] of [
    ["", "invalid_json_empty"],
    ["```json\n" + JSON.stringify(answer) + "\n```", "invalid_json_fenced"],
    ['{"clarity":80,', "invalid_json_incomplete_object"],
    ["Synthetic private answer in prose", "invalid_json_non_object"],
    ['{"clarity":}', "invalid_json_malformed_object"],
  ]) {
    assert.throws(
      () => parseScore(text),
      (error) => {
        assert.equal(error.message, "invalid_json");
        assert.equal(error.diagnosticCode, code);
        return true;
      },
    );
  }
});
test("overall is the rounded mean, ignoring a model-supplied overall", () => {
  const result = parseScore(JSON.stringify({ ...answer, overall: 99 }));
  assert.equal(result.overall, 82);
});
test("missing, out-of-range, string and nonfinite scores are rejected", () => {
  for (const clarity of [undefined, null, "90", -1, 101, Infinity, NaN]) {
    assert.throws(() => parseScore(JSON.stringify({ ...answer, clarity })));
  }
  assert.throws(() => parseScore("not json"));
});
test("unreadable audio never gets a score", () => {
  assert.throws(() => parseScore('{"unreadable":true}'), /unreadable/);
});
test("rewrite must be usable plain text; whitespace is normalized", () => {
  for (const rewrite of ["", " ", "🔥 hi", "*hi*", "a".repeat(2001), null]) {
    assert.throws(() => parseScore(JSON.stringify({ ...answer, rewrite })));
  }
  assert.equal(
    parseScore(
      JSON.stringify({ ...answer, rewrite: "I\n would like\t a raise." }),
    ).rewrite,
    "I would like a raise.",
  );
});
test("WhatsApp scorecard and rewrite are separate, under six lines, with approved bold and emojis", () => {
  const [card, rewrite] = formatScore(parseScore(JSON.stringify(answer)), "audio");
  assert.equal(
    card,
    "*Overall 82/100*\n💬 Clarity 71/100\n🔥 Confidence 86/100\n✨ Persuasion 79/100\n❤️ Warmth 90/100\nscored from: audio",
  );
  assert.equal(rewrite, `*Better version*\n${answer.rewrite}`);
  assert.equal(card.split("\n").length, 6);
  assert.equal(rewrite.split("\n").length, 2);
});
test("scorecards require an explicit server-selected scoring source", () => {
  const score = parseScore(JSON.stringify(answer));
  assert.throws(() => formatScore(score), /invalid_scoring_source/);
  assert.throws(() => formatScore(score, "model guessed audio"), /invalid_scoring_source/);
  assert.equal(formatScore(score, "transcript")[0].split("\n").at(-1), "scored from: transcript");
});
test("duration is derived from decoded mono 24kHz PCM; 90s accepted, 90s plus one sample rejected", () => {
  assert.equal(validAudio(new Uint8Array(MAX_PCM_BYTES)), true);
  assert.equal(validAudio(new Uint8Array(MAX_PCM_BYTES + 2)), false);
  assert.equal(validAudio(new Uint8Array(4798)), false);
  assert.equal(validAudio(new Uint8Array(4800)), true);
  assert.equal(validAudio(new Uint8Array(4801)), false);
});
test("at most 30 reservations per rolling hour, including hour-boundary bursts", () => {
  const now = 10 * HOUR;
  const calls = Array(30).fill(now - 1);
  assert.equal(reserveCall(calls, now + 1), null);
  assert.deepEqual(reserveCall(calls, now + HOUR), [now + HOUR]);
  assert.equal(reserveCall(calls.slice(0, 29), now).length, 30);
});
test("monthly exhaustion is distinguished from transient rate limits", () => {
  assert.equal(providerMessage("billing_hard_limit_reached"), PAUSED);
  assert.equal(providerMessage("insufficient_quota"), PAUSED);
  assert.equal(providerMessage("rate_limit_exceeded"), BUSY);
  assert.equal(providerMessage("unreadable"), UNREADABLE);
  for (const code of ["invalid_json", "invalid_facts", "invalid_scores", "missing_result_tool", "incomplete_response"]) assert.equal(providerMessage(code), COULDNT_SCORE);
  assert.equal(providerMessage("invalid_rewrite"), "Couldn't write a better version this time, please send it again.");
  assert.equal(providerMessage("call_limit_reached"), BUSY);
});
test("backend identity rejects malformed phone numbers and message IDs", () => {
  assert.equal(validIdentity("15555550123", "SYNTHETIC-1"), true);
  assert.equal(validIdentity("123@lid", "id"), false);
  assert.equal(validIdentity("15555550123", "a\nb"), false);
});
