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
export function expandResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) || !("o" in result || "u" in result)) return result;
  if (result.v !== undefined) {
    if (!result.v || typeof result.v !== 'object' || Array.isArray(result.v)) throw new Error('invalid_scores');
    return {
      unreadable: result.u,
      ...Object.fromEntries(Object.entries(FACT_WIRE).map(([name, key]) => [name, result[key]])),
      clarity: result.v.c, charisma: result.v.k, warmth: result.v.w, rewrite: result.r, ...(result.n !== undefined ? {audioFeedback:result.n} : {}),
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
