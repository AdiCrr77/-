import {checkedFeedback} from './fixtures/feedback.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareDelivery,
  claimDelivery,
  finishDelivery,
  reserveRetry,
  reserveFeedback,
  recordNote,
} from "../convex/lib/state.js";
import { BUSY, OPENER } from "../convex/lib/rules.js";
import { emptyFacts, parsePracticeResult, FACT_QUESTIONS } from "../convex/lib/facts.js";

// Minimal indexed DB adapter. Tests exercise the same handlers registered as Convex mutations.
function database() {
  const tables = { sessions: [], deliveries: [], answers: [], callLimits: [] };
  let next = 0;
  const db = {
    query(table) {
      return {
        withIndex(_name, select) {
          const constraints = [];
          const q = {
            eq(field, value) {
              constraints.push([field, value]);
              return q;
            },
          };
          select(q);
          return {
            async unique() {
              const rows = tables[table].filter((row) =>
                constraints.every(([field, value]) => row[field] === value),
              );
              assert.ok(rows.length <= 1, "indexed uniqueness");
              return rows[0] ? structuredClone(rows[0]) : null;
            },
          };
        },
      };
    },
    async insert(table, data) {
      const _id = `${table}-${++next}`;
      tables[table].push({ ...structuredClone(data), _id });
      return _id;
    },
    async patch(id, fields) {
      const row = Object.values(tables)
        .flat()
        .find((row) => row._id === id);
      assert.ok(row);
      Object.assign(row, structuredClone(fields));
    },
  };
  return { db, tables };
}
const phone = "15555550123";
const meta = (messageId, text = "") => ({ phone, messageId, text });
async function ready(ctx) {
  assert.deepEqual(await prepareDelivery(ctx, meta("selection", "1")), {
    ready: false,
    messages: [OPENER],
  });
  assert.equal((await prepareDelivery(ctx, meta("voice"))).ready, true);
}
test("selection and duplicate voice deliveries produce only one AI reservation", async () => {
  const ctx = database();
  await ready(ctx);
  assert.equal((await prepareDelivery(ctx, meta("voice"))).ready, false);
  assert.equal((await claimDelivery(ctx, meta("voice"))).claimed, true);
  assert.equal((await claimDelivery(ctx, meta("voice"))).claimed, false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 1);
});
test("two different queued voice IDs still allow only one answer per selection", async () => {
  const ctx = database();
  await ready(ctx);
  await prepareDelivery(ctx, meta("voice2"));
  await claimDelivery(ctx, meta("voice"));
  assert.equal((await claimDelivery(ctx, meta("voice2"))).claimed, false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 1);
});
test("the global quota spans different users and stops the 31st call", async () => {
  const ctx = database();
  for (let i = 0; i < 31; i++) {
    const user = `1555555${String(i).padStart(4, "0")}`;
    await prepareDelivery(ctx, { phone: user, messageId: "select", text: "1" });
    await prepareDelivery(ctx, { phone: user, messageId: "audio", text: "" });
    const result = await claimDelivery(ctx, {
      phone: user,
      messageId: "audio",
    });
    assert.equal(result.claimed, i < 30);
    if (i === 30) assert.deepEqual(result.messages, [BUSY]);
  }
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 30);
});
test("failure allows retry with a fresh voice note, without refunding the attempted call", async () => {
  const ctx = database();
  await ready(ctx);
  await claimDelivery(ctx, meta("voice"));
  await finishDelivery(ctx, {
    ...meta("voice"),
    score: null,
    messages: [BUSY],
  });
  assert.equal((await prepareDelivery(ctx, meta("retry"))).ready, true);
  assert.equal((await claimDelivery(ctx, meta("retry"))).claimed, true);
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 2);
});
test("persisted result contains scores and rewrite only, and duplicate finish cannot save twice", async () => {
  const ctx = database();
  await ready(ctx);
  await claimDelivery(ctx, meta("voice"));
  const result = {
    ...meta("voice"),
    messages: ["synthetic"],
    score: {
      clarity: 80,
      confidence: 90,
      persuasion: 70,
      warmth: 100,
      overall: 85,
      rewrite: "A made-up raise request.",
    },
  };
  await finishDelivery(ctx, result);
  await finishDelivery(ctx, result);
  assert.equal(ctx.tables.answers.length, 1);
  assert.equal(ctx.tables.answers[0].overall, 85);
  assert.equal(Object.hasOwn(ctx.tables.answers[0], "audio"), false);
});
test("starting a new selection invalidates old prepared audio", async () => {
  const ctx = database();
  await ready(ctx);
  await prepareDelivery(ctx, meta("selection2", "Ask for a raise"));
  assert.equal((await claimDelivery(ctx, meta("voice"))).claimed, false);
  assert.equal(ctx.tables.callLimits.length, 0);
});

test("missing facts continue the session, skip supplied facts and score only after all facts arrive", async () => {
  const ctx = database();
  await ready(ctx);
  let claim = await claimDelivery(ctx, meta("voice"));
  const first = parsePracticeResult(JSON.stringify({ unreadable: false, facts: { payRequest: "10%", agreedGoals: null, deliveredOutcome: "Delivered the agreed project", expectations: null } }), claim.facts);
  assert.equal(first.question, FACT_QUESTIONS.agreedGoals);
  assert.equal(first.score, null);
  await finishDelivery(ctx, { ...meta("voice"), messages: [first.question], score: null, facts: first.facts, question: first.question });
  assert.equal(ctx.tables.answers.length, 0);
  await prepareDelivery(ctx, meta("facts2"));
  claim = await claimDelivery(ctx, meta("facts2"));
  assert.equal(claim.facts.payRequest, "10%");
  assert.equal(claim.currentQuestion, FACT_QUESTIONS.agreedGoals);
  const second = parsePracticeResult(JSON.stringify({ unreadable: false, facts: { payRequest: null, agreedGoals: "Finish by Friday", deliveredOutcome: null, expectations: null } }), claim.facts);
  assert.equal(second.question, FACT_QUESTIONS.expectations);
  await finishDelivery(ctx, { ...meta("facts2"), messages: [second.question], score: null, facts: second.facts, question: second.question });
  await prepareDelivery(ctx, meta("facts3"));
  claim = await claimDelivery(ctx, meta("facts3"));
  const third = parsePracticeResult(JSON.stringify({ unreadable: false, facts: { payRequest: null, agreedGoals: null, deliveredOutcome: null, expectations: "Met expectations" }, clarity: 80, confidence: 80, persuasion: 80, warmth: 80, rewrite: "I am asking for a 10% raise based on delivering the agreed project by Friday, meeting our agreed target." }), claim.facts);
  assert.equal(third.question, null);
  assert.equal(third.score.overall, 80);
  await finishDelivery(ctx, { ...meta("facts3"), messages: ["synthetic result"], facts: third.facts, score: third.score });
  assert.equal(ctx.tables.answers.length, 1);
  assert.equal(ctx.tables.sessions[0].awaitingAnswer, false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 3);
  await prepareDelivery(ctx, meta("restart", "1"));
  assert.deepEqual(ctx.tables.sessions[0].facts, emptyFacts());
});

test("no agreed goal is accepted and oversized or malformed extracted facts are rejected", () => {
  const facts = { payRequest: "10%", agreedGoals: "No goals were agreed", deliveredOutcome: "Finished the project", expectations: "No agreed benchmark" };
  const result = { unreadable: false, facts, clarity: 75, confidence: 75, persuasion: 75, warmth: 75, rewrite: "A synthetic request based on the supplied facts." };
  assert.equal(parsePracticeResult(JSON.stringify(result)).question, null);
  assert.throws(() => parsePracticeResult(JSON.stringify({ ...result, facts: { ...facts, deliveredOutcome: "x".repeat(601) } })), /invalid_facts/);
  assert.equal(parsePracticeResult(JSON.stringify({ ...result, facts: {} })).question, FACT_QUESTIONS.payRequest);
  assert.throws(() => parsePracticeResult(JSON.stringify({ ...result, facts: [] })), /invalid_facts/);
});

test("omitted unknown facts ask only the next missing question and preserve prior facts", () => {
  const prior = { ...emptyFacts(), payRequest: "10%" };
  const result = parsePracticeResult(JSON.stringify({ unreadable: false, facts: { deliveredOutcome: "Finished the project" } }), prior);
  assert.equal(result.question, FACT_QUESTIONS.agreedGoals);
  assert.equal(result.facts.payRequest, "10%");
  assert.equal(result.facts.deliveredOutcome, "Finished the project");
  assert.equal(result.score, null);
  assert.equal(parsePracticeResult('{"unreadable":false}', prior).question, FACT_QUESTIONS.agreedGoals);
});

test("flat provider facts merge into session context without showing scores before facts are complete", () => {
  const first = parsePracticeResult(JSON.stringify({ unreadable: false, payRequest: "10%", agreedGoals: "", deliveredOutcome: "Delivered the project", expectations: "", clarity: 80, confidence: 75, persuasion: 75, warmth: 80, rewrite: "" }));
  assert.equal(first.facts.payRequest, "10%");
  assert.equal(first.question, FACT_QUESTIONS.agreedGoals);
  assert.equal(first.score, null);
  const second = parsePracticeResult(JSON.stringify({ unreadable: false, payRequest: "", agreedGoals: "Finish by Friday", deliveredOutcome: "", expectations: "Met expectations", clarity: 80, confidence: 75, persuasion: 75, warmth: 80, rewrite: "A complete synthetic raise request." }), first.facts);
  assert.equal(second.question, null);
  assert.equal(second.score.overall, 78);
});

test("automatic retry is reserved only once per processing delivery and counts toward the global cap", async () => {
  const ctx = database();
  await ready(ctx);
  assert.equal(await reserveRetry(ctx, meta("voice")), false);
  await claimDelivery(ctx, meta("voice"));
  assert.equal(await reserveRetry(ctx, meta("voice")), true);
  assert.equal(await reserveRetry(ctx, meta("voice")), false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 2);
  const capped = database();
  await ready(capped);
  await claimDelivery(capped, meta("voice"));
  capped.tables.callLimits[0].timestamps = Array(30).fill(Date.now());
  assert.equal(await reserveRetry(capped, meta("voice")), false);
  assert.equal(capped.tables.callLimits[0].timestamps.length, 30);
  assert.equal(capped.tables.deliveries.find((row) => row.messageId === "voice").retryReserved, undefined);
});

test("a new session invalidates retry reservations for an old audio call", async () => {
  const ctx = database();
  await ready(ctx);
  await claimDelivery(ctx, meta("voice"));
  await prepareDelivery(ctx, meta("restart", "1"));
  assert.equal(await reserveRetry(ctx, meta("voice")), false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length, 1);
});

test("a restarted session cannot receive facts or scores from an older in-flight answer", async () => {
  const ctx = database();
  await ready(ctx);
  await claimDelivery(ctx, meta("voice"));
  await prepareDelivery(ctx, meta("restart", "1"));
  await finishDelivery(ctx, { ...meta("voice"), messages: ["old question"], score: null, facts: { ...emptyFacts(), payRequest: "10%" }, question: "old question" });
  assert.deepEqual(ctx.tables.sessions[0].facts, emptyFacts());
  assert.equal(ctx.tables.sessions[0].currentQuestion, OPENER);
});

test("two fresh compact sessions keep clarifying vague goals and save no premature score", async () => {
  const ctx=database();
  const o={f:0,p:0,h:0,e:"level",a:true,u:0,r:0,s:1,l:true,m:0,t:0,c:0,x:0};
  for (let run=0;run<2;run++) {
    await prepareDelivery(ctx,meta(`select-specific-${run}`,"1"));
    assert.deepEqual(ctx.tables.sessions[0].facts,emptyFacts());
    const steps=[
      [{p:"12%",g:"Several goals",d:"Completed required work",e:""},FACT_QUESTIONS.agreedGoals],
      [{p:"",g:"Various targets",d:"",e:""},FACT_QUESTIONS.agreedGoals],
      [{p:"",g:"Resolve 30 tickets weekly",d:"",e:""},FACT_QUESTIONS.deliveredOutcome],
      [{p:"",g:"",d:"Resolved 40 tickets weekly",e:""},FACT_QUESTIONS.expectations],
      [{p:"",g:"",d:"",e:"Exceeded the target"},null],
    ];
    for (const [step,[facts,question]] of steps.entries()) {
      const identity=meta(`specific-${run}-${step}`);
      assert.equal((await prepareDelivery(ctx,identity)).ready,true);
      const claim=await claimDelivery(ctx,identity);
      const result=parsePracticeResult(JSON.stringify({u:false,...facts,o,r:question?"":"I am asking for a 12% raise after resolving 40 tickets weekly against our target of 30."}),claim.facts,true);
      assert.equal(result.question,question);
      assert.equal(result.score===null,question!==null);
      await finishDelivery(ctx,{...identity,facts:result.facts,score:result.score,messages:[question??"synthetic scorecard"],...(question?{question}:{})});
      assert.equal(ctx.tables.answers.length,run+(question?0:1));
    }
  }
});

test("transcription, feedback and retry each consume the shared quota once", async () => {
  const ctx=database(); await ready(ctx); await claimDelivery(ctx,meta('voice'));
  assert.equal(ctx.tables.callLimits[0].timestamps.length,1);
  assert.equal(await reserveFeedback(ctx,meta('voice')),true);
  assert.equal(await reserveFeedback(ctx,meta('voice')),false);
  assert.equal(await reserveRetry(ctx,meta('voice')),true);
  assert.equal(await reserveRetry(ctx,meta('voice')),false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length,3);
});
test("feedback cannot exceed the 30-call cap or use an obsolete session", async () => {
  const ctx=database(); await ready(ctx); await claimDelivery(ctx,meta('voice'));
  ctx.tables.callLimits[0].timestamps=Array(30).fill(Date.now());
  assert.equal(await reserveFeedback(ctx,meta('voice')),false);
  assert.equal(ctx.tables.callLimits[0].timestamps.length,30);
  ctx.tables.callLimits[0].timestamps=[];
  await prepareDelivery(ctx,meta('new-session','1'));
  assert.equal(await reserveFeedback(ctx,meta('voice')),false);
});

test("whole-round state asks each missing fact once, keeps all note counts and clears transcripts after scoring", async () => {
  const ctx=database(); await ready(ctx);
  const replies=[
    {u:false,p:'12%',g:'Resolve 30 tickets',d:'',e:'',v:{c:[{p:true,e:'raise'},{p:true,e:'goal'},{p:true,e:'raise'},{p:false,e:'repeated'}],...checkedFeedback(75,85)},n:'Hesitant but respectful delivery.',r:'I request a 12% raise.'},
    {u:false,p:'',g:'',d:'',e:'',v:{c:[{p:true,e:'raise'},{p:true,e:'goal'},{p:true,e:'raise'},{p:false,e:'repeated'}],...checkedFeedback(75,85)},n:'Clear articulation.',r:'I request a 12% raise.'},
    {u:false,p:'',g:'',d:'',e:'',v:{c:[{p:true,e:'raise'},{p:true,e:'goal'},{p:true,e:'raise'},{p:false,e:'repeated'}],...checkedFeedback(75,85)},n:'Steady voice.',r:'I request a 12% raise.'},
  ];
  const ids=['voice','round-2','round-3'];
  for(let i=0;i<ids.length;i++) {
    if(i) await prepareDelivery(ctx,meta(ids[i]));
    const claim=await claimDelivery(ctx,meta(ids[i]));
    const snapshot=await recordNote(ctx,{...meta(ids[i]),transcript:`Synthetic answer ${i}`,fillers:i?0:3,longPauses:i?0:1,hedges:i?0:1});
    assert.equal(snapshot.accepted,true);
    assert.equal(snapshot.notes.length,i+1);
    // A duplicate recording mutation must not double count this voice note.
    const repeated=await recordNote(ctx,{...meta(ids[i]),transcript:'duplicate',fillers:9,longPauses:9,hedges:9});
    assert.equal(repeated.notes.length,i+1);
    const {measureRound}=await import('../convex/lib/round.js');
    const result=parsePracticeResult(JSON.stringify(replies[i]),claim.facts,false,measureRound(snapshot.notes),{askedFacts:snapshot.askedFacts});
    assert.equal(result.askedFact,i===0?'deliveredOutcome':i===1?'expectations':null);
    await finishDelivery(ctx,{...meta(ids[i]),facts:result.facts,score:result.score,messages:[result.question??'synthetic scorecard'],audioFeedback:result.audioFeedback,...(result.question?{question:result.question,askedFact:result.askedFact}:{})});
    if(i<2) assert.equal(ctx.tables.answers.length,0);
    else {
      assert.equal(result.score.confidence,76);
      assert.ok(result.score.rewrite.includes('[add your outcome here]'));
      assert.ok(result.score.rewrite.includes('[add how your outcome compared here]'));
    }
  }
  assert.deepEqual(ctx.tables.answers[0].sourceMessageIds,ids);
  assert.deepEqual(ctx.tables.sessions[0].notes,[]);
  assert.deepEqual(ctx.tables.sessions[0].askedFacts,['deliveredOutcome','expectations']);
  await prepareDelivery(ctx,meta('fresh-round','1'));
  assert.deepEqual(ctx.tables.sessions[0].askedFacts,[]);
  assert.deepEqual(ctx.tables.sessions[0].notes,[]);
});
test("transcript recording and unreadable cleanup preserve earlier notes and cannot cross generations",async()=>{
 const ctx=database(); await ready(ctx); await claimDelivery(ctx,meta('voice'));
 await recordNote(ctx,{...meta('voice'),transcript:'Earlier synthetic answer',fillers:2,longPauses:1,hedges:0});
 await finishDelivery(ctx,{...meta('voice'),messages:['synthetic question'],score:null,question:FACT_QUESTIONS.deliveredOutcome,askedFact:'deliveredOutcome'});
 await prepareDelivery(ctx,meta('unreadable')); await claimDelivery(ctx,meta('unreadable'));
 await recordNote(ctx,{...meta('unreadable'),transcript:'Synthetic unusable content',fillers:0,longPauses:0,hedges:0});
 await finishDelivery(ctx,{...meta('unreadable'),messages:['synthetic error'],score:null,discardNote:true});
 assert.deepEqual(ctx.tables.sessions[0].notes.map(note=>note.messageId),['voice']);
 assert.deepEqual(ctx.tables.sessions[0].askedFacts,['deliveredOutcome']);
 await prepareDelivery(ctx,meta('pending')); await claimDelivery(ctx,meta('pending'));
 await prepareDelivery(ctx,meta('new-round','1'));
 const old=await recordNote(ctx,{...meta('pending'),transcript:'stale',fillers:0,longPauses:0,hedges:0});
 assert.equal(old.accepted,false);assert.deepEqual(ctx.tables.sessions[0].notes,[]);
});
