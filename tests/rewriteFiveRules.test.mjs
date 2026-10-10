import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRewrite} from '../convex/lib/rules.js';
import {addPersuasionFillIns,addMissingWarmthMoves,normalizeRaiseRange,textInstructions} from '../convex/lib/textScoring.js';
test('rewrite rule 1 rejects unnamed this and these while allowing named transcript wording',()=>{
 for(const phrase of ['I delivered all of these.','Based on this.','These are my results.'])assert.throws(()=>validateRewrite("I'd like a raise. "+phrase),error=>error.diagnosticCode==='invalid_rewrite_unnamed_reference');
 assert.doesNotThrow(()=>validateRewrite("I'd like a raise based on delivering consistently every quarter and meeting my goals."));
 assert.ok(textInstructions().includes('retain the speaker'));
});
test('rewrite rule 2 formats the asked range as a percentage only with a percentage in the source',()=>{
 const source="The average is around 11%, so I'm expecting around 15 to 16.";
 assert.equal(normalizeRaiseRange("I'd like a 15 to 16 raise.",[source]),"I'd like a 15-16% raise.");
 assert.equal(normalizeRaiseRange("I'd like a 15-16% raise.",[source]),"I'd like a 15-16% raise.");
 assert.equal(normalizeRaiseRange("I'd like a 15 to 16 raise.",['I am expecting 15 to 16.']),"I'd like a 15 to 16 raise.");
});
test('rewrite rule 3 suppresses each fill-in when the source already supplies its material',()=>{
 const checks={P2:{pass:false},P3:{pass:false}};
 const rewrite="I'd like a raise. I delivered a guide. The market average is 11%.";
 const benchmark=addPersuasionFillIns(rewrite,checks,['The average is around 11%.']);
 assert.ok(benchmark.includes('[Say what'));assert.ok(!benchmark.includes('[Name a fair benchmark'));
 const impact=addPersuasionFillIns(rewrite,checks,['The guide cut support tickets for the team.']);
 assert.ok(!impact.includes('[Say what'));assert.ok(impact.includes('[Name a fair benchmark'));
 assert.equal(addPersuasionFillIns(rewrite,checks,['The guide cut support tickets. My pay band is the benchmark.']),"I delivered a guide. The market average is 11%. I'd like a raise.");
});
test('rewrite rule 4 places fill-ins after delivery, never after a standalone ask',()=>{
 const rewrite="I'd like a raise. Our goal was a guide. I delivered the guide. I appreciate you hearing me out.";
 const result=addPersuasionFillIns(rewrite,{P2:{pass:false},P3:{pass:false}});
 assert.ok(result.startsWith("Our goal was a guide. I delivered the guide. [Say what"));
 assert.ok(result.indexOf('[Name')<result.indexOf("I'd like a raise."));
 assert.ok(!result.startsWith("I'd like a raise. ["));
});
test('rewrite rule 5 uses natural live appreciation without duplicating appreciation',()=>{
 const result=addMissingWarmthMoves("I'd like a raise. I delivered a guide.",{W1:{pass:false}});
 assert.ok(result.endsWith('I appreciate you hearing me out.'));
 assert.ok(!result.includes('Thank you for considering it'));
 assert.equal(addMissingWarmthMoves(result,{W1:{pass:false}}),result);
 assert.equal(addMissingWarmthMoves('Thank you for considering it.',{W1:{pass:false}}),'I appreciate you hearing me out.');
});
