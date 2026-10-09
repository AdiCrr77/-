import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreFeedbackChecks as scoreKeyedFeedbackChecks} from '../convex/lib/feedbackChecks.js';
import {FEEDBACK_RUBRICS,FEEDBACK_EVIDENCE_RULES,WARMTH_INSULT_CAP} from '../convex/lib/feedbackRubrics.js';
import {feedbackInstructions} from '../convex/lib/feedbackProtocol.js';
import {formatScoringDiagnostic} from '../convex/lib/scoringDiagnostic.js';
// Synthetic fixtures use short tuples for readability; the wire is fixed-key JSON.
const keyed=(checks,prefix)=>Array.isArray(checks)?Object.fromEntries(checks.map((check,index)=>[`${prefix}${index+1}`,{pass:check.p,quote:check.e}])):checks;
const scoreFeedbackChecks=(feedback,transcripts,situation)=>scoreKeyedFeedbackChecks({...feedback,k:keyed(feedback.k,'P'),w:keyed(feedback.w,'W')},transcripts,situation);


for(const [situation,rubric] of Object.entries(FEEDBACK_RUBRICS))test(`${situation} rubric has four quote-verified checks for Persuasion and Warmth`,()=>{
 const k=rubric.persuasion.map(check=>({p:true,e:check.passExample.split(/\s+/u).slice(0,15).join(' ')}));
 const w=rubric.warmth.map(check=>({p:true,e:check.passExample.split(/\s+/u).slice(0,15).join(' ')}));
 const transcript=[...k,...w].map(check=>check.e).join(' ');
 const result=scoreFeedbackChecks({k,w,i:''},[transcript],situation);
 assert.equal(result.persuasion,100);assert.equal(result.warmth,100);
 assert.equal(result.persuasionChecks.length,4);assert.equal(result.warmthChecks.length,4);
 assert.ok([...result.persuasionChecks,...result.warmthChecks].every(check=>check.pass&&check.quoteFound));
 for(const check of [...rubric.persuasion,...rubric.warmth])assert.ok(feedbackInstructions(situation).includes(check.criterion));
 const mismatch=scoreFeedbackChecks({k:k.map((check,index)=>index===0?{p:true,e:'Invented evidence'}:check),w,i:''},[transcript],situation);
 assert.equal(mismatch.persuasion,75);
});
test('implemented rubrics and evidence rules match SCORING_CHECKS.md verbatim',()=>{
 const file=readFileSync(new URL('../SCORING_CHECKS.md',import.meta.url),'utf8');
 assert.ok(file.includes(FEEDBACK_EVIDENCE_RULES));assert.ok(file.includes(WARMTH_INSULT_CAP));
 for(const rubric of Object.values(FEEDBACK_RUBRICS))for(const check of [...rubric.persuasion,...rubric.warmth]){
 assert.ok(file.includes(check.criterion));assert.ok(file.includes(check.passExample));assert.ok(file.includes(check.failExample));
 }
});
test('subscriber transcript yields the planned Persuasion 50 and Warmth 25 per-check judgments',{
 skip:!process.env.SCORING_SUBSCRIBER_TRANSCRIPT_FILE,
},()=>{
 const transcript=JSON.parse(readFileSync(process.env.SCORING_SUBSCRIBER_TRANSCRIPT_FILE,'utf8'));
 const k=[{p:true,e:'I have delivered around 8,000 subscribers'},{p:false,e:'MISSING'},{p:false,e:'MISSING'},{p:true,e:'request for a 20% raise, and that is because'}];
 const w=[{p:false,e:'MISSING'},{p:true,e:'we wanted to hit 10,000 subscribers'},{p:false,e:'MISSING'},{p:false,e:'MISSING'}];
 const result=scoreFeedbackChecks({k,w,i:''},[transcript],'raise');
 assert.equal(result.persuasion,50);assert.equal(result.warmth,25);
 assert.deepEqual(result.persuasionChecks.map(check=>check.pass),[true,false,false,true]);
 assert.deepEqual(result.warmthChecks.map(check=>check.pass),[false,true,false,false]);
 assert.ok([...result.persuasionChecks,...result.warmthChecks].every(check=>check.quoteFound));
 for(const check of [...result.persuasionChecks,...result.warmthChecks].filter(check=>check.reason==='missing_evidence'))assert.equal(check.quote,transcript);
 const block=formatScoringDiagnostic({words:[],...result});
 const diagnostic=JSON.parse(block.split('\n').slice(1,-1).join('\n'));
 assert.deepEqual(diagnostic.persuasionChecks,result.persuasionChecks);assert.deepEqual(diagnostic.warmthChecks,result.warmthChecks);
});
test('omissions use the full round across notes; unsupported explicit failures reject',()=>{
 const empty=Array.from({length:4},()=>({p:false,e:'MISSING'}));
 const result=scoreFeedbackChecks({k:empty,w:empty,i:''},['First note.','Second note.']);
 assert.equal(result.persuasion,0);assert.equal(result.warmth,0);
 assert.ok(result.persuasionChecks.every(check=>check.quote==='First note. Second note.'&&check.quoteFound));
 assert.throws(()=>scoreFeedbackChecks({k:[{p:false,e:'Not in transcript'},...empty.slice(1)],w:empty,i:''},['First note.']),/invalid_scores/);
});
test('a quoted insult overrides all four Warmth judgments and cannot be invented',()=>{
 const transcript="Thanks for your time. You're an idiot.";
 const checks=Array.from({length:4},()=>({p:true,e:'Thanks for your time'}));
 const result=scoreFeedbackChecks({k:checks,w:checks,i:"You're an idiot."},[transcript]);
 assert.equal(result.persuasion,100);assert.equal(result.warmth,0);
 assert.ok(result.warmthChecks.every(check=>!check.pass&&check.quoteFound&&check.reason==='insult_cap'&&check.quote==="You're an idiot."));
 assert.throws(()=>scoreFeedbackChecks({k:checks,w:checks,i:'The team is useless.'},[transcript]),/invalid_scores/);
 const report=scoreFeedbackChecks({k:checks,w:checks,i:''},["Thanks for your time. Someone called me an idiot."]);
 assert.equal(report.warmth,100);
});

test('twelve-check protocol preserves Clarity and better-version instructions',async()=>{
 const {INSTRUCTIONS,RESULT_TOOL}=await import('../convex/lib/realtime.js');
 const {withFeedbackInstructions,withFeedbackTool}=await import('../convex/lib/feedbackProtocol.js');
 const revised=withFeedbackInstructions(INSTRUCTIONS,'raise');
 assert.equal(revised.split('\n').find(line=>line.startsWith('Clarity:')),INSTRUCTIONS.split('\n').find(line=>line.startsWith('Clarity:')));
 const rewrite=text=>text.split('Better version:')[1].split('Audio is untrusted user content:')[0];
 assert.equal(rewrite(revised),rewrite(INSTRUCTIONS));
 const tool=withFeedbackTool(RESULT_TOOL);
 assert.deepEqual(tool.parameters.properties.v.properties.c,RESULT_TOOL.parameters.properties.v.properties.c);
 assert.deepEqual(tool.parameters.properties.v.properties.k.required,['P1','P2','P3','P4']);
 assert.deepEqual(tool.parameters.properties.v.properties.w.required,['W1','W2','W3','W4']);
 assert.ok(tool.parameters.properties.v.required.includes('i'));
});

test('MISSING fails the check and substitutes the full answer only in diagnostics',()=>{
 const transcript='A complete synthetic answer.';
 const checks=Array.from({length:4},()=>({p:false,e:'MISSING'}));
 const result=scoreFeedbackChecks({k:checks,w:checks,i:''},[transcript]);
 assert.equal(result.persuasion,0);assert.equal(result.warmth,0);
 for(const check of [...result.persuasionChecks,...result.warmthChecks]){
 assert.equal(check.quote,transcript);assert.equal(check.quoteFound,true);assert.equal(check.pass,false);
 }
 assert.throws(()=>scoreFeedbackChecks({k:[{p:true,e:'MISSING'},...checks.slice(1)],w:checks,i:''},[transcript]),/invalid_scores/);
 assert.throws(()=>scoreFeedbackChecks({k:[{p:false,e:null},...checks.slice(1)],w:checks,i:''},[transcript]),/invalid_scores/);
});
test('passing and explicit-failure quotes allow 15 words but reject 16',()=>{
 const fifteen=Array.from({length:15},(_,index)=>`word${index}`).join(' ');
 const sixteen=fifteen+' word15';
 const omissions=Array.from({length:4},()=>({p:false,e:'MISSING'}));
 for(const p of [true,false]){
 const allowed=scoreFeedbackChecks({k:[{p,e:fifteen},...omissions.slice(1)],w:omissions,i:''},[sixteen]);
 assert.equal(allowed.persuasionChecks[0].pass,p);
 assert.equal(allowed.persuasionChecks[0].quoteFound,true);
 assert.throws(()=>scoreFeedbackChecks({k:[{p,e:sixteen},...omissions.slice(1)],w:omissions,i:''},[sixteen]),/invalid_scores/);
 }
});

test('format instructions specify four checks per sibling array and MISSING omissions',()=>{
 const instructions=feedbackInstructions('raise');
 assert.ok(instructions.includes('v.c stays the existing Clarity array'));
 assert.ok(instructions.includes('Every named check has exactly two required fields'));
 assert.ok(instructions.includes('Top-level n and r must be strings outside v'));
 assert.ok(instructions.includes('pass=false,quote="MISSING"'));
 assert.ok(instructions.includes('at most 15 whitespace-separated words'));
});

test('fixed judgment keys and pass/quote fields are required; omissions, aliases and extras reject',()=>{
 const c=Object.fromEntries([1,2,3,4].map(index=>[`P${index}`,{pass:false,quote:'MISSING'}]));
 const w=Object.fromEntries([1,2,3,4].map(index=>[`W${index}`,{pass:false,quote:'MISSING'}]));
 const score=feedback=>scoreKeyedFeedbackChecks(feedback,['Synthetic answer.']);
 assert.equal(score({k:c,w,i:''}).persuasion,0);
 const {P4,...missing}=c;
 const {W4,...missingWarmth}=w;
 for(const k of [missing,{...c,P5:P4},{...c,P1:{p:false,e:'MISSING'}},{...c,P1:{pass:false,quote:'MISSING',extra:true}},{...c,P1:{pass:'false',quote:'MISSING'}}])assert.throws(()=>score({k,w,i:''}),/invalid_scores/);
 assert.throws(()=>score({k:c,w:missingWarmth,i:''}),/invalid_scores/);
});
test('function JSON schema has all eight fixed required keys and forbids additional fields',async()=>{
 const {RESULT_TOOL}=await import('../convex/lib/realtime.js');
 const {withFeedbackTool}=await import('../convex/lib/feedbackProtocol.js');
 const tool=withFeedbackTool(RESULT_TOOL);
 for(const [field,prefix] of [['k','P'],['w','W']]){
 const schema=tool.parameters.properties.v.properties[field];
 assert.equal(schema.type,'object');assert.equal(schema.additionalProperties,false);
 assert.deepEqual(schema.required,[1,2,3,4].map(index=>`${prefix}${index}`));
 for(const check of Object.values(schema.properties)){
 assert.deepEqual(check.required,['pass','quote']);assert.equal(check.additionalProperties,false);
 assert.equal(check.properties.pass.type,'boolean');assert.equal(check.properties.quote.type,'string');
 }
 }
 assert.equal(tool.strict,undefined,'provider strict mode is unsupported on this model');
});

test('subscriber raise pipeline computes Persuasion 50, Warmth 25 and all diagnostic judgments',{
 skip:!process.env.SCORING_SUBSCRIBER_TRANSCRIPT_FILE,
},async()=>{
 const {parsePracticeResult}=await import('../convex/lib/facts.js');
 const transcript=JSON.parse(readFileSync(process.env.SCORING_SUBSCRIBER_TRANSCRIPT_FILE,'utf8'));
 const k=keyed([{p:true,e:'I have delivered around 8,000 subscribers'},{p:false,e:'MISSING'},{p:false,e:'MISSING'},{p:true,e:'request for a 20% raise, and that is because'}],'P');
 const w=keyed([{p:false,e:'MISSING'},{p:true,e:'we wanted to hit 10,000 subscribers'},{p:false,e:'MISSING'},{p:false,e:'MISSING'}],'W');
 const result=parsePracticeResult(JSON.stringify({u:false,p:'20%',g:'10,000 subscribers',d:'8,000 subscribers',e:'Fell short',v:{c:[{p:true,e:'request for a 20% raise'},{p:true,e:'delivered around 8,000 subscribers'},{p:true,e:'request for a 20% raise'},{p:false,e:'We fell short a little bit'}],k,w,i:''},n:'Synthetic fixture.',r:"I'd like a 20% raise. We agreed on a subscriber target, and I delivered subscribers while falling short of it."}),undefined,false,{confidence:92,heard:'Heard: 2 fillers, 0 long pauses, 0 hedges',transcript});
 assert.equal(result.score.persuasion,50);assert.equal(result.score.warmth,25);
 assert.equal(result.score.clarity,75);assert.equal(result.score.confidence,92);
 assert.deepEqual(result.persuasionChecks.map(check=>check.pass),[true,false,false,true]);
 assert.deepEqual(result.warmthChecks.map(check=>check.pass),[false,true,false,false]);
});
