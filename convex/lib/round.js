import { validateRewrite } from "./rules.js";
import { v } from 'convex/values';
import { measurementFromCounts } from './confidence.js';
export const factNameValidator = v.union(v.literal('payRequest'),v.literal('agreedGoals'),v.literal('deliveredOutcome'),v.literal('expectations'));
export const roundNoteValidator = v.object({
  messageId:v.string(), transcript:v.string(), fillers:v.number(), longPauses:v.number(), hedges:v.number(), audioFeedback:v.optional(v.string()),
});
export function measureRound(notes) {
  const totals={fillers:0,longPauses:0,hedges:0};
  for(const note of notes) for(const key of Object.keys(totals)) {
    if(!Number.isSafeInteger(note[key]) || note[key]<0) throw new Error('invalid_transcription');
    totals[key]+=note[key];
  }
  // Counts were measured inside each note. Never join timestamp timelines.
  return measurementFromCounts(totals);
}
export const GAP_TEXT = {
  payRequest:'[add your raise amount here]', agreedGoals:'[add your agreed goal here]',
  deliveredOutcome:'[add your outcome here]', expectations:'[add how your outcome compared here]',
};
const GAP_SENTENCES = {
  payRequest:`I'm asking for ${GAP_TEXT.payRequest}.`,agreedGoals:`We agreed on ${GAP_TEXT.agreedGoals}.`,
  deliveredOutcome:`I delivered ${GAP_TEXT.deliveredOutcome}.`,expectations:`Compared with our agreement, ${GAP_TEXT.expectations}.`,
};
export function ensureRewriteGaps(rewrite, missing) {
  validateRewrite(rewrite);
  for(const name of missing) if(!rewrite.includes(GAP_TEXT[name])) rewrite+=` ${GAP_SENTENCES[name]}`;
  return rewrite;
}
