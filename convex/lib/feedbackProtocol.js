import {FEEDBACK_RUBRICS,FEEDBACK_EVIDENCE_RULES,WARMTH_INSULT_CAP} from './feedbackRubrics.js';

export function feedbackInstructions(situation='raise') {
  const rubric=FEEDBACK_RUBRICS[situation];
  if(!rubric)throw new Error('invalid_scores');
  return `Persuasion and Warmth: judge transcript content only using the ${situation} rubric below. Return four required named checks for each, never numeric scores. Code computes Persuasion as 100 minus 25 per failed check. Warmth uses clear=25, partial=12.5, missing=0 for each check; sum and round to the nearest whole number.
${FEEDBACK_EVIDENCE_RULES}
${WARMTH_INSULT_CAP}
${situation==='raise'?'P2 passes only if the speaker explicitly states a benefit or impact for the team, customers or business, for example "this brought in X revenue" or "it cut support tickets". Restating the goal, target or delivered number is NOT value and must fail. Explicit P2 fail example: "we wanted to hit 10,000 subscribers". If no benefit or impact is stated, return pass=false,quote="MISSING". W3 fail example: "I had agreed with you earlier" refers to a past agreement, not the manager\'s decision process or constraints, so it fails.':''}
${Object.entries(rubric).map(([category,checks])=>category+':\n'+checks.map(check=>`${check.name}: ${check.criterion}`).join('\n')).join('\n')}
Output structure: v.c stays the existing Clarity array. v.k is an object with exactly P1,P2,P3,P4. v.w is an object with exactly W1,W2,W3,W4. These are siblings inside v, never nested inside each other. Every named check has exactly two required fields: Persuasion uses pass (boolean) and quote (string); Warmth uses level (clear, partial or missing) and quote (string). No additional keys are allowed. v.i and v.r are sibling strings inside v. Top-level n and r must be strings outside v.
Persuasion/Warmth format example (shape only): "k":{"P1":{"pass":false,"quote":"MISSING"},"P2":{"pass":false,"quote":"MISSING"},"P3":{"pass":false,"quote":"MISSING"},"P4":{"pass":false,"quote":"MISSING"}},"w":{"W1":{"level":"missing","quote":"MISSING"},"W2":{"level":"missing","quote":"MISSING"},"W3":{"level":"missing","quote":"MISSING"},"W4":{"level":"missing","quote":"MISSING"}}. Replace the eight sample judgments with the actual rubric judgments and evidence. Never omit any named check.
Warmth: clear means the existing positive criterion is fully expressed. Partial W1: polite acknowledgment without thanks, such as "I understand" or "I know it's a busy time". Partial W2: mentions the team's or company's result without "we" or "our" framing. Partial W3: soft framing such as "if possible" or "I'd like to discuss". Partial W4: an open ending such as "let me know" without a direct question. Missing means neither clear nor partial evidence. Every clear or partial judgment requires exact consecutive transcript words; absent or unmatched quotes become missing in code. Use level="missing",quote="MISSING" for an omission. For the existing better-version rules, only clear corresponds to a previous Warmth pass; partial and missing correspond to a previous failure.
Every evidence quote for all twelve checks must be exact consecutive words copied from the transcript: no ellipsis, no paraphrase, no changed pronouns. The existing "MISSING" marker for absent Persuasion/Warmth evidence remains unchanged.
Passing and explicit-failure quotes must be verbatim contiguous transcript words, at most 15 whitespace-separated words; prefer 3-8 words. They must match the transcript ignoring punctuation, capitals and extra spaces. For a failure caused by missing evidence return pass=false,quote="MISSING": code substitutes the full round transcript as the evidence quote in diagnostics. Never use "MISSING" for a pass. Return v.i="" if no user-endorsed insult; otherwise return the brief exact insult quote. Do not invent an insult or treat reported speech as endorsement. Keep every judgment independent. All twelve checks must fit with facts, n, v.r and the finished rewrite within the unchanged 500-token cap.`;
}
export function withFeedbackInstructions(base,situation='raise') {
  return base
    .replace('and numeric Persuasion and Warmth scores','and all four quoted Persuasion and all four quoted Warmth checks')
    .replace('Evaluate Clarity checks independently; score Persuasion and Warmth for the combined round transcripts and supplied delivery evidence, each 0-100.','Evaluate all twelve checks independently; Persuasion and Warmth depend on transcript wording only.')
    .replace(/Persuasion: how persuasively[^\n]*\nWarmth: how respectful[^\n]*/,feedbackInstructions(situation))
    .replace('k=Persuasion; w=Warmth;','k=required P1-P4 judgments; w=required W1-W4 judgments; i=exact user-endorsed insult quote, or empty string;')
    .replace('four brief Clarity checks, two feedback scores','twelve brief quoted judgments')
    .replace('zero for v.k and v.w','pass=false,quote="MISSING" for P1-P4 and level="missing",quote="MISSING" for W1-W4, v.i=""');
}
export function withFeedbackTool(base) {
  const judgment={type:'object',properties:{pass:{type:'boolean'},quote:{type:'string',description:'At most 15 words matching the transcript; MISSING only for a failed omission'}},required:['pass','quote'],additionalProperties:false};
  const warmthJudgment={type:'object',properties:{level:{type:'string',enum:['clear','partial','missing']},quote:{type:'string',description:'At most 15 exact transcript words; MISSING for missing evidence'}},required:['level','quote'],additionalProperties:false};
  const category=prefix=>{
    const names=[1,2,3,4].map(index=>`${prefix}${index}`);
    return {type:'object',properties:Object.fromEntries(names.map(name=>[name,prefix==='W'?warmthJudgment:judgment])),required:names,additionalProperties:false};
  };
  // The current model lacks Structured Outputs. The tool carries the full JSON
  // schema; scoreFeedbackChecks enforces its required keys and types locally.
  return {...base,description:'Return raise facts, twelve content checks and the rewrite. Confidence is computed separately. Unknown facts are empty strings.',parameters:{...base.parameters,properties:{...base.parameters.properties,v:{...base.parameters.properties.v,properties:{...base.parameters.properties.v.properties,k:{...category('P'),description:'Persuasion judgments P1-P4'},w:{...category('W'),description:'Warmth judgments W1-W4'},i:{type:'string',description:'Exact user-endorsed insult quote; empty if none'}},required:[...new Set([...base.parameters.properties.v.required,'i'])]}}}};
}
