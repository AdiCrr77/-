import { roundNoteValidator, factNameValidator } from "./lib/round.js";
import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";
import { prepareDelivery, claimDelivery, finishDelivery, reserveFeedback as reserveFeedbackHandler, recordNote as recordNoteHandler, reserveRetry as reserveRetryHandler } from "./lib/state.js";
import { factsValidator } from "./lib/facts.js";

const identity = { phone: v.string(), messageId: v.string() };
const decision = v.object({
  ready: v.boolean(),
  messages: v.array(v.string()),
});
const score = v.object({
  clarity: v.number(),
  confidence: v.number(),
  charisma: v.number(),
  warmth: v.number(),
  overall: v.number(),
  rewrite: v.string(),
});
export const recordNote = internalMutation({
  args:{...identity,transcript:v.string(),fillers:v.number(),longPauses:v.number(),hedges:v.number()},
  returns:v.object({accepted:v.boolean(),notes:v.array(roundNoteValidator),askedFacts:v.array(factNameValidator)}),
  handler:recordNoteHandler,
});
export const reserveFeedback = internalMutation({
  args: identity,
  returns: v.boolean(),
  handler: reserveFeedbackHandler,
});
export const reserveRetry = internalMutation({
  args: identity,
  returns: v.boolean(),
  handler: reserveRetryHandler,
});
export const prepare = internalMutation({
  args: { ...identity, text: v.string() },
  returns: decision,
  handler: prepareDelivery,
});
export const claim = internalMutation({
  args: identity,
  returns: v.object({ claimed: v.boolean(), messages: v.array(v.string()), facts: v.optional(factsValidator), currentQuestion: v.optional(v.string()), askedFacts: v.optional(v.array(factNameValidator)) }),
  handler: claimDelivery,
});
export const finish = internalMutation({
  args: {
    ...identity,
    messages: v.array(v.string()),
    score: v.union(score, v.null()),
    facts: v.optional(factsValidator),
    question: v.optional(v.string()),
    askedFact: v.optional(factNameValidator),
    audioFeedback: v.optional(v.string()),
    discardNote: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: finishDelivery,
});
