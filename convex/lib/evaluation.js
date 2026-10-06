import { parsePracticeResult } from "./facts.js";
import { reportDiagnostic } from "./diagnostics.js";

const RETRYABLE = new Set([
  "invalid_json", "invalid_facts", "invalid_scores", "invalid_rewrite",
  "missing_result_tool", "invalid_response", "incomplete_response",
]);

// Retry only malformed provider output, once, after an atomic global quota reservation.
export async function evaluatePractice({ evaluate, reserveRetry, facts, report = reportDiagnostic, reportRejected = () => {}, requireObservations = false, measurement }) {
  const attempt = async () => {
    let text;
    try { text = await evaluate(); }
    catch (error) {
      if (RETRYABLE.has(error.message) && typeof error.rejectedResponseText === "string") reportRejected(error.rejectedResponseText);
      throw error;
    }
    try { return parsePracticeResult(text, facts, requireObservations, measurement); }
    catch (error) {
      if (RETRYABLE.has(error.message)) reportRejected(text);
      throw error;
    }
  };
  try {
    return await attempt();
  } catch (error) {
    if (!RETRYABLE.has(error.message)) throw error;
    report(error);
    if (!await reserveRetry()) throw new Error("call_limit_reached");
    return attempt();
  }
}

// The claim reserves the transcription call; every subsequent provider call
// has its own atomic reservation. Reuse measured counts on feedback retry.
export async function evaluateMeasuredPractice({ transcribe, reserveFeedback, ...options }) {
  const measurement = await transcribe();
  if (!await reserveFeedback()) throw new Error('call_limit_reached');
  return evaluatePractice({ ...options, measurement, requireObservations: false });
}
