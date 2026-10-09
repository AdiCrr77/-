"use node";
import {scoreText} from './lib/textScoring.js';
import {internalAction} from './_generated/server.js';
import {internal} from './_generated/api.js';
import {v} from 'convex/values';
import {INSTRUCTIONS,RESULT_TOOL} from './lib/realtime.js';
import {withFeedbackInstructions,withFeedbackTool} from './lib/feedbackProtocol.js';
import {scoreFeedbackChecks} from './lib/feedbackChecks.js';
import {expandResult} from './lib/resultWire.js';
import {validateRewrite} from './lib/rules.js';
import {measurementFromCounts} from './lib/confidence.js';
import {emptyFacts} from './lib/facts.js';

// Internal, transcript-only cap verification. No transcript or reply is stored,
// no WhatsApp message is sent, and each call reserves the existing shared quota.
export const checkReplyCap=internalAction({
  args:{transcript:v.string(),fullTranscript:v.optional(v.string()),counts:v.optional(v.object({fillers:v.number(),longPauses:v.number(),hedges:v.number()}))},returns:v.string(),
  handler:async(ctx,{transcript,fullTranscript,counts})=>{
    if(!await ctx.runMutation(internal.clarityQuota.reserve,{}))throw new Error('call_limit_reached');
    if(!process.env.OPENAI_API_KEY)throw new Error('missing_openai_key');
    const context={facts:emptyFacts(),currentQuestion:'I have 2 mins before my next meeting - what are you asking on pay?',round:{askedFacts:[],notes:[{transcript,...(fullTranscript?{fullTranscript}:{})}]}};
    let completion;
    let completionError;
    try {await scoreText(process.env.OPENAI_API_KEY,context,{onCompletion:value=>{completion=value;}});}
    catch(error){if(!completion)throw error;completionError=error.message;}
    let feedback;
    let clarity;
    let validationError=completionError??null;
    try{
      const parsed=JSON.parse(completion.raw);
      for(const field of ['u','p','g','d','e','v','n','r'])if(!(field in parsed))throw new Error('missing_field');
      if(!Array.isArray(parsed.v?.c)||parsed.v.c.length!==4)throw new Error('missing_judgments');
      feedback=scoreFeedbackChecks(parsed.v,[transcript],'raise');
      clarity=expandResult(parsed,[transcript]).clarity;
      validateRewrite(parsed.r);
    }catch(error){validationError=['invalid_scores','invalid_rewrite','missing_field','missing_judgments'].includes(error.message)?error.message:'invalid_response';}
    const fits=completion.status==='completed'&&validationError===null&&Number.isFinite(completion.outputTokens)&&completion.outputTokens<=500;
    return JSON.stringify({...completion,fits,validationError,...(feedback?{persuasion:feedback.persuasion,warmth:feedback.warmth,persuasionChecks:feedback.persuasionChecks,warmthChecks:feedback.warmthChecks}:{}),...(clarity!==undefined?{clarity}:{}),...(counts?{confidence:measurementFromCounts(counts).confidence}:{})});
  },
});
