import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreText,SCORING_MODEL,SCORING_SCHEMA,textInstructions} from '../convex/lib/textScoring.js';
import {BASE_INSTRUCTIONS} from '../convex/lib/realtime.js';
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
 assert.ok(instructions.includes("The first sentence must state the user's ask directly as a statement"));assert.ok(instructions.includes('at most 59 whitespace-separated words'));assert.ok(instructions.includes('Return n=""'));
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
 assert.ok(rewrite.includes('Thank you for considering it.'));assert.ok(rewrite.includes('I know the decision is yours.'));assert.ok(rewrite.endsWith("What's your view?"));
 assert.equal(addMissingWarmthMoves(rewrite,checks),rewrite);
 assert.ok(rewrite.split(/\s+/).length<60);
});

test('P2 failed adds only the business-value fill-in',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 const rewrite=addPersuasionFillIns("I'd like a 12% raise based on my delivery. I fell short of the target.",{P2:{pass:false},P3:{pass:true}});
 assert.deepEqual(rewrite.match(/\[[^\]]*\]/g),['[Say what the outcome you delivered meant for the team, customers or business.]']);
 assert.ok(rewrite.indexOf('[Say')<rewrite.indexOf('I fell short'));
});
test('P3 failed adds only the fair-benchmark fill-in',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 assert.deepEqual(addPersuasionFillIns("I'd like a 12% raise.",{P2:{pass:true},P3:{pass:false}}).match(/\[[^\]]*\]/g),['[Name a fair benchmark, such as your pay band or the new responsibilities you took on.]']);
});
test('both P2 and P3 failed add exactly two fill-ins without invented numbers or outcomes',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 const rewrite=addPersuasionFillIns("I'd like a 12% raise.",{P2:{pass:false},P3:{pass:false}});
 assert.equal(rewrite.match(/\[[^\]]*\]/g).length,2);
 assert.doesNotMatch(rewrite.match(/\[[^\]]*\]/g).join(' '),/\d/);
});
test('neither P2 nor P3 failed leaves the rewrite unchanged with no brackets',async()=>{
 const {addPersuasionFillIns}=await import('../convex/lib/textScoring.js');
 const rewrite="I'd like a 12% raise based on my delivery.";
 assert.equal(addPersuasionFillIns(rewrite,{P2:{pass:true},P3:{pass:true}}),rewrite);
});
