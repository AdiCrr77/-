import { measureRound } from "./round.js";
import { parsePracticeResult } from "./facts.js";
import { reportDiagnostic, rewriteRejectionRule } from "./diagnostics.js";

const RETRYABLE = new Set([
  "invalid_json", "invalid_facts", "invalid_scores", "invalid_rewrite",
  "missing_result_tool", "invalid_response", "incomplete_response",
]);

// Retry only malformed provider output, once, after an atomic global quota reservation.
export async function evaluatePractice({ evaluate, reserveRetry, facts, report = reportDiagnostic, reportRejected = () => {}, onRewriteRejected = () => {}, onFeedbackScoresRejected = () => {}, requireObservations = false, measurement, round, clarityTranscripts }) {
  const attempt = async () => {
    let text;
    try { text = await evaluate(); }
    catch (error) {
      if (error.message === "invalid_rewrite") onRewriteRejected(rewriteRejectionRule(error));
      else if (RETRYABLE.has(error.message) && typeof error.rejectedResponseText === "string") reportRejected(error.rejectedResponseText);
      throw error;
    }
    try { return parsePracticeResult(text, facts, requireObservations, measurement, round, clarityTranscripts); }
    catch (error) {
      if (error.message === 'invalid_scores' && error.feedbackScores) onFeedbackScoresRejected(error.feedbackScores);
      if (error.message === "invalid_rewrite") onRewriteRejected(rewriteRejectionRule(error));
      else if (RETRYABLE.has(error.message)) reportRejected(text);
      throw error;
    }
  };
  try {
    return await attempt();
  } catch (error) {
    if (!RETRYABLE.has(error.message)) throw error;
    report(error);
    if (!await reserveRetry()) throw error.message === "invalid_rewrite" ? error : new Error("call_limit_reached");
    return attempt();
  }
}

// The claim reserves the transcription call; every subsequent provider call
// has its own atomic reservation. Reuse measured counts on feedback retry.
export async function evaluateMeasuredPractice({ transcribe, reserveFeedback, recordTranscript, ...options }) {
  const note=await transcribe();
  let snapshot;
  if(recordTranscript) {
    snapshot=await recordTranscript(note);
    if(!snapshot.accepted) throw new Error('stale_session');
  }
  const measurement=snapshot?measureRound(snapshot.notes):note;
  if (!await reserveFeedback()) throw new Error('call_limit_reached');
  return evaluatePractice({ ...options,
    evaluate:()=>options.evaluate(snapshot?{notes:snapshot.notes,askedFacts:snapshot.askedFacts}:undefined),
    round:snapshot?{askedFacts:snapshot.askedFacts}:undefined,
    clarityTranscripts:snapshot?snapshot.notes.map(note=>note.transcript):[note.transcript],
    measurement, requireObservations:false,
  });
}
