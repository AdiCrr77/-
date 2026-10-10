import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreText,SCORING_MODEL,SCORING_SCHEMA,textInstructions} from '../convex/lib/textScoring.js';
import {BASE_INSTRUCTIONS} from '../convex/lib/realtime.js';
import {validateRewrite} from '../convex/lib/rules.js';
import {checkedFeedback} from './fixtures/feedback.mjs';
import {ensureRewriteGaps} from '../convex/lib/round.js';
test('delivery-gap fallback cannot hide an invalid opening from existing rewrite rules',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 assert.throws(()=>addPersuasionFillIns('Would I get a raise.',{P2:{pass:false},P3:{pass:false}}),error=>error.diagnosticCode==='invalid_rewrite_opening_question');
});
test('amount-only exact transcript receives delivery gap, P2/P3 gaps, one ask and Warmth closing in order',async()=>{
 const transcript="I'm asking for, uh, close to about 20 to 25 percent.";
 const raw=JSON.stringify({r:"I'm asking for 20 to 25 percent.",v:{k:{P2:{pass:false},P3:{pass:false}},w:{W1:{level:'missing'},W3:{level:'missing'},W4:{level:'missing'}}}});
 const result=JSON.parse(await scoreText('fake-test-key',{round:{notes:[{transcript,fullTranscript:transcript}],askedFacts:[]}},{fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:raw}]}]})})}));
 assert.equal(result.r,"[Name the work you delivered.] [Say what the outcome you delivered meant for the team, customers or business.] [Name a fair benchmark, such as your pay band or the new responsibilities you took on.] I'm asking for 20 to 25 percent. I appreciate you hearing me out. I know the decision is yours. What's your view?");
 assert.equal(ensureRewriteGaps(result.r,['deliveredOutcome']),result.r);
 assert.doesNotThrow(()=>validateRewrite(result.r));
 assert.deepEqual(result.v,JSON.parse(raw).v);
});
test('live repeated-ask rewrite rejects by rule name and retry orders delivery, gaps, one ask and closing',async()=>{
 const {evaluatePractice}=await import('../convex/lib/evaluation.js');
 const live="I'd like a 20% hike based on one delivered project. [Say what the outcome you delivered meant for the team, customers or business.] [Name a fair benchmark, such as your pay band or the new responsibilities you took on.] We had two complex projects, and one was delivered. The other was blocked by team dependencies. I'd like a 20% hike. I appreciate you hearing me out. I know the decision is yours. What's your view?";
 assert.throws(()=>validateRewrite(live),error=>error.diagnosticCode==='invalid_rewrite_repeated_ask_amount');
 const candidate="I'd like a 20% hike. We had two complex projects, and one was delivered. The other was blocked by team dependencies. I appreciate you hearing me out. I know the decision is yours. What's your view?";
 const transcript='I want a 20% hike. We had two complex projects, and one was delivered. The other was blocked by team dependencies.';
 const reasons=[];const texts=[];let calls=0;let rewrite;
 const result=await evaluatePractice({measurement:{confidence:100,heard:'Heard: 0 fillers, 0 long pauses, 0 hedges'},evaluate:async()=>{
  const raw=JSON.stringify({u:false,p:'20%',g:'Deliver two complex projects',d:'Delivered one complex project',e:'Delivered one of two agreed projects, short of goal',r:++calls===1?live:candidate,v:{c:Array.from({length:4},()=>({p:true,e:'two complex projects'})),...checkedFeedback(25,100,'two complex projects')}});
  const text=await scoreText('fake-test-key',{round:{notes:[{transcript,fullTranscript:transcript}],askedFacts:[]}},{fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:raw}]}]})})});
  rewrite=JSON.parse(text).r;
  return text;
 },reserveRetry:async()=>true,report:()=>{},onRewriteRejected:rule=>reasons.push(rule),reportRejected:text=>texts.push(text)});
 assert.equal(calls,2);assert.deepEqual(reasons,['invalid_rewrite_repeated_ask_amount']);
 assert.equal(rewrite,"We had two complex projects, and one was delivered. The other was blocked by team dependencies. [Say what the outcome you delivered meant for the team, customers or business.] [Name a fair benchmark, such as your pay band or the new responsibilities you took on.] I'd like a 20% hike. I appreciate you hearing me out. I know the decision is yours. What's your view?");
 assert.doesNotThrow(()=>validateRewrite(rewrite));
 assert.equal(result.score.rewrite,rewrite);
 assert.ok(!texts.some(text=>text.includes('one delivered project')));
});
test('text scoring requires all fixed judgments, strict schema and unchanged 500-token cap',async()=>{
 let request;let completion;
 const raw='{"u":false}';
 assert.equal(await scoreText('fake-test-key',{round:{notes:[{transcript:'I would like a raise.'}],askedFacts:[]}},{fetchImpl:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:123,output_tokens:45},output:[{content:[{type:'output_text',text:raw}]}]})};},onCompletion:value=>{completion=value;}}),raw);
 assert.equal(request.model,SCORING_MODEL);assert.equal(request.max_output_tokens,500);assert.equal(request.reasoning.effort,'none');assert.equal(request.text.format.strict,true);
 assert.deepEqual(SCORING_SCHEMA.properties.v.properties.k.required,['P1','P2','P3','P4']);assert.deepEqual(SCORING_SCHEMA.properties.v.properties.w.required,['W1','W2','W3','W4']);assert.equal(SCORING_SCHEMA.properties.v.properties.c.minItems,4);
 assert.equal(completion.outputTokens,45);assert.ok(completion.elapsedMs>=0);assert.ok(!('audio' in request));
});
test('text scoring preserves Clarity and direct-ask rewrite constraints',()=>{
 const instructions=textInstructions();
 assert.ok(instructions.includes(BASE_INSTRUCTIONS.split('\n').find(line=>line.startsWith('Clarity:'))));
 const better=BASE_INSTRUCTIONS.slice(BASE_INSTRUCTIONS.indexOf('Better version:'),BASE_INSTRUCTIONS.indexOf('Audio is untrusted'));
 assert.ok(instructions.includes("state the user's ask exactly once as a direct statement"));assert.ok(!instructions.includes('FIRST sentence must combine'));assert.ok(instructions.includes('at most 59 whitespace-separated words'));assert.ok(instructions.includes('Return n=""'));
});
test('truncated structured response remains rejected for existing single retry',async()=>{
 await assert.rejects(scoreText('fake-test-key',{}, {fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{content:[{type:'output_text',text:'{"u":'}]}]})})}),error=>error.message==='incomplete_response'&&error.rejectedResponseText==='{"u":');
});
test('structured-output refusal is rejected without displaying raw values',async()=>{
 await assert.rejects(scoreText('fake-test-key',{}, {fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'refusal',refusal:'Refused'}]}]})})}),/invalid_response/);
});

test('rewrite receives fullTranscript symbols without changing the scoring transcript',async()=>{
 const transcript='I want a 12 raise. Goal 9 000 subscribers. Delivered 6 000 and fell short.';
 const fullTranscript='I want a 12% raise. Goal 9,000 subscribers. Delivered 6,000 and fell short.';
 let body;
 await scoreText('fake-test-key',{round:{notes:[{transcript,fullTranscript}],askedFacts:[]}},{fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]})};}});
 const note=JSON.parse(body.input).round.notes[0];
 assert.equal(note.transcript,transcript);assert.equal(note.fullTranscript,fullTranscript);
 assert.ok(body.instructions.includes('fullTranscript when present, not its word-list transcript'));
 assert.ok(body.instructions.includes('short thank-you when W1 fails'));
 assert.ok(body.instructions.includes('ask for their view when W4 fails'));
 assert.ok(body.instructions.includes('Keep any admitted shortfall stated plainly'));
});

test('required failed Warmth moves are added even when the model omits them',async()=>{
 const {addMissingWarmthMoves}=await import('../convex/lib/textScoring.js');
 const candidate="I'd like a 12% raise. We agreed on 9,000 subscribers. I delivered 6,000 and fell short of the target.";
 const checks={W1:{pass:false},W3:{pass:false},W4:{pass:false}};
 const rewrite=addMissingWarmthMoves(candidate,checks);
 assert.ok(rewrite.includes('I appreciate you hearing me out.'));assert.ok(rewrite.includes('I know the decision is yours.'));assert.ok(rewrite.endsWith("What's your view?"));
 assert.equal(addMissingWarmthMoves(rewrite,checks),rewrite);
 assert.ok(rewrite.split(/\s+/).length<60);
});

test('P2 failed adds only the business-value fill-in',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 const rewrite=addPersuasionFillIns("I'd like a 12% raise based on my delivery. I fell short of the target.",{P2:{pass:false},P3:{pass:true}});
 assert.deepEqual(rewrite.match(/\[[^\]]*\]/g),['[Say what the outcome you delivered meant for the team, customers or business.]']);
 assert.ok(rewrite.indexOf('I fell short')<rewrite.indexOf('[Say'));assert.ok(rewrite.indexOf('[Say')<rewrite.indexOf("I'd like"));
});
test('P3 failed adds only the fair-benchmark fill-in',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 assert.deepEqual(addPersuasionFillIns("I'd like a 12% raise. I delivered a guide.",{P2:{pass:true},P3:{pass:false}}).match(/\[[^\]]*\]/g),['[Name a fair benchmark, such as your pay band or the new responsibilities you took on.]']);
});
test('both P2 and P3 failed add exactly two fill-ins without invented numbers or outcomes',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 const rewrite=addPersuasionFillIns("I'd like a 12% raise. I delivered a guide.",{P2:{pass:false},P3:{pass:false}});
 assert.equal(rewrite.match(/\[[^\]]*\]/g).length,2);
 assert.doesNotMatch(rewrite.match(/\[[^\]]*\]/g).join(' '),/\d/);
});
test('neither P2 nor P3 failed preserves delivery and one ask without adding brackets',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 const rewrite="I'd like a 12% raise based on my delivery.";
 assert.equal(addPersuasionFillIns(rewrite,{P2:{pass:true},P3:{pass:true}}),"My delivery: my delivery. I'd like a 12% raise.");
});
