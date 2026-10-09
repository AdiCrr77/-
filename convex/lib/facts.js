import { ensureRewriteGaps } from "./round.js";
import { usableFact } from "./factQuality.js";
import { expandResult } from "./resultWire.js";
import { scoreObservations } from "./rubric.js";
import { v } from "convex/values";
import { parseScore } from "./rules.js";

export const FACT_QUESTIONS = {
  payRequest: "What hike are you asking for?",
  agreedGoals: "What specific goal had we agreed on?",
  deliveredOutcome: "What specific outcome did you deliver?",
  expectations: "Did that outcome exceed, meet or fall short of what we agreed?",
};
export const factsValidator = v.object(Object.fromEntries(
  Object.keys(FACT_QUESTIONS).map((name) => [name, v.string()]),
));
export const emptyFacts = () => Object.fromEntries(Object.keys(FACT_QUESTIONS).map((name) => [name, ""]));

// The model extracts facts; Convex decides whether enough context exists to score.
export function parsePracticeResult(text, prior = emptyFacts(), requireObservations = false, measurement, round, clarityTranscripts) {
  let result;
  try { result = JSON.parse(text); } catch { return parseScore(text); }
  result = expandResult(result, clarityTranscripts ?? round?.notes?.map(note=>note.transcript) ?? (typeof measurement?.transcript === 'string' ? [measurement.transcript] : []));
  if (result?.unreadable) throw new Error("unreadable");
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("invalid_facts");
  const clarityReason = result.clarityReason;
  if (clarityReason !== undefined && (typeof clarityReason !== 'string' || !clarityReason.trim() || (!result.clarityChecks && clarityReason.length > 700))) throw new Error('invalid_response');
  // Non-strict function calling may omit unknown fields. Missing never means invented.
  const extracted = result.facts ?? result;
  if (typeof extracted !== "object" || Array.isArray(extracted)) throw new Error("invalid_facts");
  const facts = emptyFacts();
  for (const name of Object.keys(FACT_QUESTIONS)) {
    const value = extracted[name];
    if (value != null && (typeof value !== "string" || value.length > 600)) throw new Error("invalid_facts");
    facts[name] = usableFact(name, value ?? "") || usableFact(name, prior[name] ?? "");
  }
  const missingFacts=Object.keys(FACT_QUESTIONS).filter(name=>!facts[name]);
  const missing=missingFacts.find(name=>!round?.askedFacts?.includes(name));
  if(round && !missing) result.rewrite=ensureRewriteGaps(result.rewrite,missingFacts);
  let audioFeedback;
  if(round) {
    if(typeof result.audioFeedback !== 'string' || result.audioFeedback.length>400) throw new Error('invalid_response');
    audioFeedback=result.audioFeedback.trim();
  }
  text = JSON.stringify(result);
  let heard;
  if (!missing && measurement) {
    if (!Number.isInteger(measurement.confidence) || measurement.confidence<0 || measurement.confidence>100 || typeof measurement.heard !== 'string') throw new Error('invalid_transcription');
    result.confidence = measurement.confidence;
    text = JSON.stringify(result);
    heard = measurement.heard;
  } else if (!missing && (requireObservations || result.observations !== undefined)) {
    const evaluated = scoreObservations(result.observations);
    Object.assign(result, evaluated.scores);
    text = JSON.stringify(result);
    heard = evaluated.heard;
  }
  return { ...(result.persuasionChecks ? {persuasionChecks:result.persuasionChecks,warmthChecks:result.warmthChecks,warmthInsult:result.warmthInsult} : {}), ...(result.clarityChecks ? {clarityChecks:result.clarityChecks} : {}), ...(clarityReason !== undefined ? {clarityReason:clarityReason.trim()} : {}), ...(round ? {askedFact:missing ?? null, audioFeedback} : {}), ...(heard ? { heard } : {}), facts, question: missing ? FACT_QUESTIONS[missing] : null, score: missing ? null : parseScore(text) };
}
