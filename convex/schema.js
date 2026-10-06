import { roundNoteValidator, factNameValidator } from "./lib/round.js";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { factsValidator } from "./lib/facts.js";

export default defineSchema({
  sessions: defineTable({
    phone: v.string(),
    situation: v.literal("raise"),
    generation: v.string(),
    awaitingAnswer: v.boolean(),
    facts: v.optional(factsValidator),
    currentQuestion: v.optional(v.string()),
    notes: v.optional(v.array(roundNoteValidator)),
    askedFacts: v.optional(v.array(factNameValidator)),
  }).index("by_phone", ["phone"]),
  deliveries: defineTable({
    phone: v.string(),
    messageId: v.string(),
    generation: v.string(),
    status: v.union(
      v.literal("prepared"),
      v.literal("processing"),
      v.literal("finished"),
    ),
    messages: v.array(v.string()),
    createdAt: v.number(),
    retryReserved: v.optional(v.boolean()),
    feedbackReserved: v.optional(v.boolean()),
  }).index("by_phone_message", ["phone", "messageId"]),
  answers: defineTable({
    phone: v.string(),
    generation: v.string(),
    situation: v.literal("raise"),
    clarity: v.number(),
    confidence: v.number(),
    charisma: v.number(),
    warmth: v.number(),
    overall: v.number(),
    rewrite: v.string(),
    sourceMessageIds: v.optional(v.array(v.string())),
  }).index("by_phone", ["phone"]),
  // One global row: keeping only 30 timestamps bounds both storage and reads.
  callLimits: defineTable({
    name: v.string(),
    timestamps: v.array(v.number()),
  }).index("by_name", ["name"]),
});
