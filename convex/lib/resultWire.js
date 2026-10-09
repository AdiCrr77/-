import { scoreFeedbackChecks } from "./feedbackChecks.js";
import { quoteMatches, hasSecondRequest } from "./clarity.js";
import { OBSERVATION_FIELDS } from "./rubric.js";

// Compact provider field names only. Application facts, rubric and rewrite stay unchanged.
export const FACT_WIRE = { payRequest: "p", agreedGoals: "g", deliveredOutcome: "d", expectations: "e" };
export const OBSERVATION_WIRE = {
  fillers: "f", longPauses: "p", hedges: "h", askEnding: "e", earlyAsk: "a",
  unclearPhrases: "u", restarts: "r", supportingFacts: "s", linkedAsk: "l",
  emphasizedPoints: "m", respectfulPhrases: "t", collaborativePhrases: "c", hostilePhrases: "x",
};
export const COMPACT_OBSERVATION_FIELDS = Object.fromEntries(Object.entries(OBSERVATION_WIRE).map(
  ([name, key]) => [key, { ...OBSERVATION_FIELDS[name], description: name }],
));
export function expandResult(result, transcripts = [], situation = 'raise') {
  if (!result || typeof result !== "object" || Array.isArray(result) || !("o" in result || "u" in result)) return result;
  if (result.v !== undefined) {
    if (!result.v || typeof result.v !== 'object' || Array.isArray(result.v)) throw new Error('invalid_scores');
    const feedback = scoreFeedbackChecks(result.v,transcripts,situation);
    const checks = result.v.c;
    if (!Array.isArray(checks) || checks.length !== 4 || checks.some(check =>
      !check || typeof check !== 'object' || Array.isArray(check) ||
      typeof check.p !== 'boolean')) throw new Error('invalid_scores');
    const clarityChecks = checks.map((check, index) => {
      const quote = typeof check.e === 'string' ? check.e : null;
      const quoteFound = quoteMatches(quote, transcripts);
      const pass = index === 2 ? check.p || !hasSecondRequest(quote, transcripts) : check.p && quoteFound;
      return {check:index + 1, aiPass:check.p, quote, quoteFound, pass};
    });
    const failed = clarityChecks.flatMap(check => check.pass ? [] : [`${check.check}: "${check.quote ?? "[missing quote]"}"`]);
    return {
      unreadable: result.u,
      ...Object.fromEntries(Object.entries(FACT_WIRE).map(([name, key]) => [name, result[key]])),
      clarity: 100 - 25 * failed.length, persuasion: feedback.persuasion, warmth: feedback.warmth, rewrite: result.r, ...(result.n !== undefined ? {audioFeedback:result.n} : {}),
      clarityChecks,
      persuasionChecks:feedback.persuasionChecks,warmthChecks:feedback.warmthChecks,warmthInsult:feedback.warmthInsult,
      clarityReason: failed.length ? failed.join("; ") : "All four checks passed.",
    };
  }
  if (!result.o || typeof result.o !== "object" || Array.isArray(result.o)) {
    if (result.u === true) return { unreadable: true };
    throw new Error("invalid_scores");
  }
  return {
    unreadable: result.u,
    ...Object.fromEntries(Object.entries(FACT_WIRE).map(([name, key]) => [name, result[key]])),
    observations: Object.fromEntries(Object.entries(OBSERVATION_WIRE).map(([name, key]) => [name, result.o[key]])),
    rewrite: result.r,
  };
}
