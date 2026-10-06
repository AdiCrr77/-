export const OPENER =
  "I have 2 mins before my next meeting - what are you asking on pay?";
export const BUSY = "Busy right now. Try again in a few minutes.";
export const COULDNT_SCORE = "Couldn't score that one. Please send it again.";
const VALIDATION_FAILURES = new Set([
  "invalid_transcription", "invalid_json", "invalid_facts", "invalid_scores", "invalid_rewrite",
  "missing_result_tool", "invalid_response", "incomplete_response", "invalid_scoring_source",
]);
export const PAUSED = "Practice is paused for now. Back soon.";
export const UNREADABLE = "I couldn't hear that clearly. Send it again?";
export const LOADING = "Listening to your answer...";
export const MAX_PCM_BYTES = 90 * 24000 * 2;
export const HOUR = 60 * 60 * 1000;

export function validIdentity(phone, messageId) {
  return (
    typeof phone === "string" &&
    /^\+?[1-9]\d{6,14}$/.test(phone) &&
    typeof messageId === "string" &&
    /^[\w-]{1,128}$/.test(messageId)
  );
}
export function validAudio(bytes) {
  // Realtime requires at least 100 ms. Duration comes from decoded PCM, never metadata.
  return (
    bytes instanceof Uint8Array &&
    bytes.byteLength >= 4800 &&
    bytes.byteLength <= MAX_PCM_BYTES &&
    bytes.byteLength % 2 === 0
  );
}
export function reserveCall(timestamps, now) {
  const active = timestamps.filter((t) => t > now - HOUR);
  return active.length >= 30 ? null : [...active, now];
}
export function parseScore(text) {
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    // Diagnose structure only. Never retain the native parse error, which can quote the user's words.
    const value = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(value);
    let diagnosticCode;
    if (!value) diagnosticCode = "invalid_json_empty";
    else if (fence) {
      try {
        JSON.parse(fence[1]);
        diagnosticCode = "invalid_json_fenced";
      } catch {
        diagnosticCode = "invalid_json_malformed_object";
      }
    } else if (!value.startsWith("{"))
      diagnosticCode = "invalid_json_non_object";
    else if (!value.endsWith("}"))
      diagnosticCode = "invalid_json_incomplete_object";
    else diagnosticCode = "invalid_json_malformed_object";
    const error = new Error("invalid_json");
    error.diagnosticCode = diagnosticCode;
    throw error;
  }
  if (result?.unreadable === true) throw new Error("unreadable");
  const names = ["clarity", "confidence", "charisma", "warmth"];
  if (
    !result ||
    names.some(
      (name) =>
        typeof result[name] !== "number" ||
        !Number.isFinite(result[name]) ||
        result[name] < 0 ||
        result[name] > 100,
    )
  ) {
    const error = new Error("invalid_scores");
    error.diagnosticCode = !result || names.some((name) => result[name] == null)
      ? "invalid_scores_missing"
      : names.some((name) => typeof result[name] !== "number")
        ? "invalid_scores_type"
        : "invalid_scores_range";
    throw error;
  }
  if (
    typeof result.rewrite !== "string" ||
    !result.rewrite.trim() ||
    result.rewrite.length > 2000 ||
    /[\p{Extended_Pictographic}*]/u.test(result.rewrite)
  ) {
    const error = new Error("invalid_rewrite");
    error.diagnosticCode = typeof result.rewrite !== "string"
      ? "invalid_rewrite_missing"
      : !result.rewrite.trim()
        ? "invalid_rewrite_empty"
        : result.rewrite.length > 2000
          ? "invalid_rewrite_length"
          : "invalid_rewrite_format";
    throw error;
  }
  return Object.fromEntries([
    ...names.map((name) => [name, result[name]]),
    ["overall", Math.round(names.reduce((sum, name) => sum + result[name], 0) / 4)],
    ["rewrite", result.rewrite.replace(/\s+/g, " ").trim()],
  ]);
}
export function formatScore(score, scoredFrom, heard) {
  if (!["audio", "transcript"].includes(scoredFrom)) throw new Error("invalid_scoring_source");
  return [
    `*Overall ${score.overall}/100*\n💬 Clarity ${score.clarity}/100\n🔥 Confidence ${score.confidence}/100\n✨ Charisma ${score.charisma}/100\n❤️ Warmth ${score.warmth}/100${heard ? `\n${heard}` : ""}\nscored from: ${scoredFrom}`,
    `*Better version*\n${score.rewrite}`,
  ];
}
export function providerMessage(code) {
  return [
    "insufficient_quota",
    "billing_hard_limit_reached",
    "monthly_budget_exceeded",
  ].includes(code)
    ? PAUSED
    : code === "unreadable"
      ? UNREADABLE
      : VALIDATION_FAILURES.has(code)
        ? COULDNT_SCORE
      : BUSY;
}
