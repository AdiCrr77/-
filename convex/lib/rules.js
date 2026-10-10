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
export function isRaiseAsk(sentence) {
  return /\b(?:i(?:['’]d| would) (?:like|appreciate)|i (?:want|request|am (?:asking|requesting|seeking|looking for))|i['’]m (?:asking|requesting|seeking|looking for)|my (?:ask|request))\b/iu.test(sentence) ||
    /^\s*(?:a\s+)?\d+(?:\.\d+)?\s*(?:%|percent)\s*(?:pay )?(?:raise|hike|increase)\b/iu.test(sentence) ||
    /\b(?:could|can|would|will)\b[^.!?]*\d+(?:\.\d+)?\s*(?:%|percent)[^.!?]*\b(?:raise|hike|increase)\b/iu.test(sentence);
}
function repeatedAskAmount(rewrite) {
  const clauses=rewrite.replace(/\[[^\]]*\]/gu,'').split(/\.(?!\d)|[!?;。！？]/u);
  const amounts=clauses.filter(isRaiseAsk).flatMap(clause=>{
    const ask=clause.split(/\bbased on\b/iu)[0];
    const amounts=ask.match(/\d+(?:\.\d+)?(?:\s*(?:to|[-–])\s*\d+(?:\.\d+)?)?\s*(?:%|percent)|(?:[$₹£€]\s*\d[\d,]*(?:\.\d+)?)/giu)??[];
    return amounts.map(amount=>amount.toLowerCase().replace(/percent/gu,'%').replace(/\s*to\s*|–/gu,'-').replace(/\s|,/gu,''));
  });
  return new Set(amounts).size!==amounts.length;
}
export function validateRewrite(rewrite) {
  let reason;
  if (typeof rewrite !== "string") reason = "missing";
  else if (!rewrite.trim()) reason = "empty";
  else if (rewrite.length > 2000) reason = "length";
  else if (/=|\b(?:payRequest|agreedGoals|deliveredOutcome|expectations)\b/iu.test(rewrite)) reason = "fields";
  else if (/[\p{Extended_Pictographic}*]/u.test(rewrite)) reason = "format";
  else if (repeatedAskAmount(rewrite)) reason = "repeated_ask_amount";
  else if (rewrite.replace(/\[[^\[\]]*\]/gu, '').trim().split(/\s+/u).filter(Boolean).length >= 60) reason = "word_limit";
  else if (/\b(?:deserve|owed|i\s+expect)\b/iu.test(rewrite)) reason = "entitlement";
  else if (/\b(?:this|these)\s*(?:[.,;!?]|$)|\b(?:this|these)\s+(?:is|was|are|were|means|shows|supports)\b/iu.test(rewrite)) reason = "unnamed_reference";
  else if (/i wanted to take a moment|\bleverag\w*|\balign\w*/iu.test(rewrite)) reason = "corporate_phrase";
  if (!reason) {
    // A decimal point is part of the amount, not a sentence boundary.
    const spoken=rewrite.replace(/\[[^\]]*\]/gu,'').trim();
    const sentences=spoken.match(/[\s\S]*?(?:[?!。！？]|\.(?!\d)|$)/gu)?.filter(sentence=>sentence.trim())??[];
    const firstSentence = sentences.find(isRaiseAsk) ?? sentences[0] ?? '';
    if (/[?？]/u.test(firstSentence) || /^(?:["“'‘]\s*)?(?:could|can|would|will|do|does|did|is|are|should|may|might)\b/iu.test(firstSentence)) reason = "opening_question";
    else if (/\b(?:could\s+we|can\s+we|would\s+it\s+be\s+possible|i\s+was\s+wondering|revisit|maybe|just|i\s+think|hoping)\b/iu.test(firstSentence)) reason = "opening_phrase";
    else {
      const clauses = rewrite.split(/\.(?!\d)|[!?;。！？]/u)
        .map(clause => clause.toLowerCase().replace(/[’‘]/gu, "'").replace(/[^\p{L}\p{N}'%]+/gu, ' ').trim())
        .filter(Boolean);
      if (new Set(clauses).size !== clauses.length) reason = "repetition";
      else if (clauses.some((clause,index) =>
        /\b(?:(?:fell|fall|falling|fallen) short|(?:miss|missed|missing) (?:the |our |a |agreed )?target)\b/u.test(clause) &&
        /\b(?:because|that's why)\b/u.test(clauses[index+1] ?? ''))) reason = "shortfall_link";
    }
  }
  if (reason) {
    const error = new Error("invalid_rewrite");
    error.diagnosticCode = `invalid_rewrite_${reason}`;
    throw error;
  }
}
// Missing feedback is a validation failure, never a numeric default.
export function validateFeedbackScores(result) {
  const names = ['persuasion', 'warmth'];
  if (!result || names.some(name => typeof result[name] !== 'number' ||
    !Number.isFinite(result[name]) || result[name] < 0 || result[name] > 100)) {
    const error = new Error('invalid_scores');
    error.feedbackScores = {persuasion:result?.persuasion,warmth:result?.warmth};
    error.diagnosticCode = !result || names.some(name => result[name] == null)
      ? 'invalid_scores_missing'
      : names.some(name => typeof result[name] !== 'number')
        ? 'invalid_scores_type' : 'invalid_scores_range';
    throw error;
  }
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
  validateFeedbackScores(result);
  const names = ["clarity", "confidence", "persuasion", "warmth"];
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
  validateRewrite(result.rewrite);
  return Object.fromEntries([
    ...names.map((name) => [name, result[name]]),
    ["overall", Math.round(names.reduce((sum, name) => sum + result[name], 0) / 4)],
    ["rewrite", result.rewrite.replace(/\s+/g, " ").trim()],
  ]);
}
export function formatScore(score, scoredFrom, heard) {
  if (!["audio", "transcript"].includes(scoredFrom)) throw new Error("invalid_scoring_source");
  validateFeedbackScores(score);
  validateRewrite(score.rewrite);
  return [
    `*Overall ${score.overall}/100*\n💬 Clarity ${score.clarity}/100\n🔥 Confidence ${score.confidence}/100\n✨ Persuasion ${score.persuasion}/100\n❤️ Warmth ${score.warmth}/100${heard ? `\n${heard}` : ""}\nscored from: ${scoredFrom}`,
    `*Better version*\n${score.rewrite}`,
  ];
}
export function providerMessage(code) {
  if (code === "invalid_rewrite") return "Couldn't write a better version this time, please send it again.";
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
