import test from "node:test";
import assert from "node:assert/strict";
import { parseScore } from "../convex/lib/rules.js";
import {
  reportDiagnostic,
  audioFailureCode,
  reportRejectedResponse,
} from "../convex/lib/diagnostics.js";

test("requested rejected-response text is logged intact except keys and audio payloads", () => {
  const logs = [];
  const text = '{"confidence":null,"facts":"synthetic facts","rewrite":"synthetic answer"}';
  reportRejectedResponse(text, [], (line) => logs.push(line));
  assert.equal(logs[0], `practice_scoring_rejected_response ${JSON.stringify(text)}`);
  reportRejectedResponse('{"secret":"synthetic-key","audio":"AAAA","rewrite":"sk-synthetic-secret"}', ["synthetic-key"], (line) => logs.push(line));
  assert.ok(!logs[1].includes("synthetic-key"));
  assert.ok(!logs[1].includes("AAAA"));
  assert.ok(!logs[1].includes("sk-synthetic-secret"));
});

test("audio diagnostics distinguish empty, short, odd-length and overlong PCM", () => {
  assert.equal(audioFailureCode(new Uint8Array(0)), "invalid_audio_empty");
  assert.equal(
    audioFailureCode(new Uint8Array(4798)),
    "invalid_audio_too_short",
  );
  assert.equal(
    audioFailureCode(new Uint8Array(4801)),
    "invalid_audio_odd_length",
  );
  assert.equal(
    audioFailureCode(new Uint8Array(4320002)),
    "invalid_audio_too_long",
  );
});

test("known provider failures emit only a fixed diagnostic code", () => {
  const logs = [];
  reportDiagnostic(new Error("unknown_parameter"), (line) => logs.push(line));
  assert.deepEqual(logs, ["practice_scoring_error code=unknown_parameter"]);
});

test("invalid score diagnostics distinguish missing, wrong type and range without answer text", () => {
  for (const [confidence, code] of [[null, "missing"], ["80", "type"], [101, "range"]]) {
    const logs = [];
    try {
      parseScore(JSON.stringify({ clarity: 80, confidence, persuasion: 80, warmth: 80, rewrite: "Synthetic private answer" }));
      assert.fail("Invalid score accepted");
    } catch (error) {
      assert.equal(error.message, "invalid_scores");
      reportDiagnostic(error, (line) => logs.push(line));
    }
    assert.deepEqual(logs, [`practice_scoring_error code=invalid_scores_${code}`]);
  }
});

test("rewrite diagnostics identify the failed rule without revealing the rewrite", () => {
  for (const [rewrite, code] of [[null, "missing"], [" ", "empty"], ["x".repeat(2001), "length"], ["*Synthetic private answer*", "format"]]) {
    const logs = [];
    assert.throws(() => parseScore(JSON.stringify({ clarity: 80, confidence: 80, persuasion: 80, warmth: 80, rewrite })), (error) => {
      assert.equal(error.message, "invalid_rewrite");
      reportDiagnostic(error, (line) => logs.push(line));
      return true;
    });
    assert.deepEqual(logs, [`practice_scoring_error code=invalid_rewrite_${code}`]);
  }
});

test("JSON parse errors never log the model's answer text", () => {
  const logs = [];
  let error;
  try {
    JSON.parse("Made-up personal answer: I want a raise");
  } catch (caught) {
    error = caught;
  }
  reportDiagnostic(error, (line) => logs.push(line));
  assert.deepEqual(logs, ["practice_scoring_error code=invalid_json"]);
});

test("unknown errors, stacks, credentials, phone numbers and audio are excluded", () => {
  const logs = [];
  const error = new Error("synthetic-secret 15555550123 personal answer");
  error.code = "synthetic-secret";
  error.audio = new Uint8Array([1, 2, 3]);
  reportDiagnostic(error, (line) => logs.push(line));
  assert.deepEqual(logs, ["practice_scoring_error code=unknown_error"]);
});

test("socket HTTP rejection and missing key have distinct safe codes", () => {
  const logs = [];
  for (const code of [
    "connection_http_401",
    "connection_http_404",
    "missing_openai_key",
    "call_limit_reached",
  ])
    reportDiagnostic(new Error(code), (line) => logs.push(line));
  assert.deepEqual(
    logs,
    [
      "connection_http_401",
      "connection_http_404",
      "missing_openai_key",
      "call_limit_reached",
    ].map((code) => `practice_scoring_error code=${code}`),
  );
});

test("completion diagnostics report only fixed statuses, reasons and numeric token counts", () => {
  const logs = [];
  const error = new Error("incomplete_response");
  error.completionMetadata = {
    status: "incomplete", status_details: {type: "incomplete", reason: "max_output_tokens"}, usage: {output_tokens: 500},
  };
  reportDiagnostic(error, line => logs.push(line));
  assert.deepEqual(logs, [
    "practice_scoring_error code=incomplete_response",
    "practice_scoring_completion status=incomplete type=incomplete reason=max_output_tokens output_tokens=500",
  ]);
  const unsafe = new Error("incomplete_response");
  unsafe.completionMetadata = {status:"synthetic-secret",status_details:{type:"private audio",reason:"private answer"},usage:{output_tokens:"synthetic-key"}};
  const safeLogs = [];
  reportDiagnostic(unsafe, line => safeLogs.push(line));
  assert.equal(safeLogs[1], "practice_scoring_completion status=unknown type=unknown reason=unknown output_tokens=unknown");
});

test("token breakdown logs numeric counts only", () => {
 const error=new Error("incomplete_response");
 error.completionMetadata={status:"incomplete"};
 error.tokenBreakdown={text:7,audio:0,reasoning:493};
 const logs=[];
 reportDiagnostic(error,line=>logs.push(line));
 assert.equal(logs.at(-1),"practice_scoring_tokens text=7 audio=0 reasoning=493");
 error.tokenBreakdown={text:"private",audio:-1,reasoning:null};
 reportDiagnostic(error,line=>logs.push(line));
 assert.equal(logs.at(-1),"practice_scoring_tokens text=unknown audio=unknown reasoning=unknown");
});
