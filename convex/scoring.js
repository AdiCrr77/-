"use node";
import WebSocket from "ws";
import { internalAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import {
  formatScore,
  providerMessage,
  validAudio,
  UNREADABLE,
  BUSY,
} from "./lib/rules.js";
import { scoreAudio } from "./lib/realtime.js";
import { reportDiagnostic, audioFailureCode, reportRejectedResponse } from "./lib/diagnostics.js";
import { formatScoringDiagnostic } from "./lib/scoringDiagnostic.js";
import { transcribeAudio } from "./lib/transcription.js";
import { evaluateMeasuredPractice } from "./lib/evaluation.js";

export const score = internalAction({
  args: { phone: v.string(), messageId: v.string(), audio: v.bytes() },
  returns: v.union(v.array(v.string()),v.object({messages:v.array(v.string()),scoringDiagnostic:v.string()})),
  handler: async (ctx, { phone, messageId, audio }) => {
    const identity = { phone, messageId };
    const bytes = new Uint8Array(audio);
    try {
      if (!validAudio(bytes)) {
        reportDiagnostic(new Error(audioFailureCode(bytes)));
        await ctx.runMutation(internal.practice.finish, {
          ...identity,
          messages: [UNREADABLE],
          score: null,
        });
        return [UNREADABLE];
      }
      if (!process.env.OPENAI_API_KEY) {
        reportDiagnostic(new Error("missing_openai_key"));
        await ctx.runMutation(internal.practice.finish, {
          ...identity,
          messages: [BUSY],
          score: null,
        });
        return [BUSY];
      }
      const claim = await ctx.runMutation(internal.practice.claim, identity);
      if (!claim.claimed) {
        if (claim.messages.includes(BUSY))
          reportDiagnostic(new Error("call_limit_reached"));
        return claim.messages;
      }
      let score = null;
      let facts;
      let question;
      let messages;
      let askedFact;
      let audioFeedback;
      let discardNote=false;
      let scoringDiagnostic;
      try {
        const result = await evaluateMeasuredPractice({
          transcribe: async () => {
            const measured=await transcribeAudio(process.env.OPENAI_API_KEY,bytes);
            scoringDiagnostic=formatScoringDiagnostic(measured.scoringDiagnostic,[process.env.OPENAI_API_KEY,process.env.PRACTICE_BRIDGE_TOKEN]);
            return measured;
          },
          recordTranscript: ({transcript,fillers,longPauses,hedges}) => ctx.runMutation(internal.practice.recordNote,{...identity,transcript,fillers,longPauses,hedges}),
          reserveFeedback: () => ctx.runMutation(internal.practice.reserveFeedback, identity),
          evaluate: (round) => scoreAudio(WebSocket, process.env.OPENAI_API_KEY, bytes, 30000, { facts: claim.facts, currentQuestion: claim.currentQuestion, round }),
          reserveRetry: () => ctx.runMutation(internal.practice.reserveRetry, identity),
          facts: claim.facts,
          reportRejected: (text) => reportRejectedResponse(text, [process.env.OPENAI_API_KEY, process.env.PRACTICE_BRIDGE_TOKEN]),
        });
        score = result.score;
        facts = result.facts;
        question = result.question;
        askedFact=result.askedFact;
        audioFeedback=result.audioFeedback;
        // Source is selected by this server audio path, never claimed by the model.
        messages = question ? [question] : formatScore(score, "audio", result.heard);
      } catch (error) {
        reportDiagnostic(error);
        discardNote=error.message==='unreadable';
        messages = [providerMessage(error.message)];
      }
      await ctx.runMutation(internal.practice.finish, {
        ...identity,
        messages,
        score,
        ...(facts ? { facts } : {}),
        ...(question ? { question } : {}),
        ...(askedFact ? { askedFact } : {}),
        ...(audioFeedback ? { audioFeedback } : {}),
        ...(discardNote ? { discardNote } : {}),
      });
      return scoringDiagnostic?{messages,scoringDiagnostic}:messages;
    } finally {
      bytes.fill(0);
    }
  },
});
