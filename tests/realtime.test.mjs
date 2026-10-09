import {checkedFeedback} from './fixtures/feedback.mjs';
import { parsePracticeResult } from "../convex/lib/facts.js";
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { scoreAudio } from "../convex/lib/realtime.js";
import { FACT_WIRE } from "../convex/lib/resultWire.js";
import { parseScore } from "../convex/lib/rules.js";

class Socket extends EventEmitter {
  static instance;
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.sent = [];
    Socket.instance = this;
  }
  send(text) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.closed = true;
  }
  event(event) {
    this.emit("message", Buffer.from(JSON.stringify(event)));
  }
}
test("original PCM is sent unchanged, with text-only replies and a 500-token cap", async () => {
  const pcm = new Uint8Array(48000).fill(13);
  const promise = scoreAudio(Socket, "synthetic-test-key", pcm);
  const socket = Socket.instance;
  assert.match(socket.url, /model=gpt-realtime-2\.1-mini$/);
  socket.event({ type: "session.created" });
  const session = socket.sent[0].session;
  assert.deepEqual(session.output_modalities, ["text"]);
  assert.equal(session.max_output_tokens, 500);
  assert.equal(session.audio.input.turn_detection, null);
  for (const rule of [
    "start from the user's own transcript across the round and edit it; do not write a new answer",
    "Keep their words and phrases wherever they work",
    "Fix only what lowered the weakest available score",
    "first person, natural contractions, short sentences and everyday words",
    "Do not fill in missing facts",
    "Return only the finished answer in rewrite",
    "Never return a Confidence score",
    "Convex computes Confidence from a separate word-timestamp transcription",
  ]) {
    assert.ok(session.instructions.includes(rule), `Missing rewrite instruction: ${rule}`);
  }
  socket.event({ type: "session.updated" });
  const audio = Buffer.concat(
    socket.sent
      .filter((e) => e.type === "input_audio_buffer.append")
      .map((e) => Buffer.from(e.audio, "base64")),
  );
  assert.deepEqual(audio, Buffer.from(pcm));
  assert.equal(socket.sent.at(-1).type, "input_audio_buffer.commit");
  socket.event({ type: "input_audio_buffer.committed" });
  assert.deepEqual(socket.sent.at(-1), {
    type: "response.create",
    response: {
      output_modalities: ["text"],
      max_output_tokens: 500,
      reasoning: { effort: "minimal" },
      tool_choice: { type: "function", name: "submit_practice_result" },
    },
  });
  socket.event({
    type: "response.done",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "submit_practice_result",
          arguments: "synthetic result",
        },
      ],
    },
  });
  assert.equal(await promise, "synthetic result");
  assert.equal(socket.closed, true);
});

test("better-version prompt retains under 60 words and banned corporate phrase rules", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  Socket.instance.event({ type: "session.created" });
  const instructions = Socket.instance.sent[0].session.instructions;
  assert.ok(instructions.includes('under 60 words (at most 59 whitespace-separated words), including all visible gaps'));
  assert.ok(instructions.includes('sayable in about 20 seconds'));
  assert.ok(instructions.includes('count the words and check for banned phrases; edit again if there are 60 or more words or a banned phrase'));
  for (const phrase of ['I wanted to take a moment', 'leverage', 'align']) {
    assert.ok(instructions.includes(`"${phrase}"`));
  }
  assert.ok(!instructions.includes('Improve all four scoring areas together'));
  assert.ok(instructions.includes('Never invent numbers, outcomes, dates, achievements, motives or commitments'));
  assert.ok(instructions.includes('[add your outcome here]'));
  assert.equal(Socket.instance.sent[0].session.tools[0].parameters.properties.v.properties.c.type, 'array');
  Socket.instance.event({ type: 'error', error: { code: 'synthetic_failure' } });
  await assert.rejects(promise, /synthetic_failure/);
});

test('Clarity uses only whole-round content checks and requests a nested diagnostic reason', async () => {
  const promise = scoreAudio(Socket, 'synthetic', new Uint8Array(4800));
  Socket.instance.event({ type: 'session.created' });
  const session = Socket.instance.sent[0].session;
  const clarity = session.instructions.split('\n').find(line => line.startsWith('Clarity:'));
  for (const rule of [
    "judge content only across the whole round's transcripts in chronological order, never delivery",
    '(1) the ask is stated in the first two sentences of the whole answer',
    '(2) the key facts are present: the goal, what was delivered, and the result with a number if the user supplied one',
    '(3) one clear ask, not several', '(4) no repeating or circling back',
    'Ignore articulation, pacing, tone, fillers, hesitations and pauses for Clarity',
    'In v.r list every failed check number and its exact failing transcript words',
    'never put it in the rewrite or other user-facing text',
  ]) assert.ok(clarity.includes(rule), rule);
  assert.ok(!clarity.includes('do articulation, pacing and phrasing make the ask easy to follow'));
  const feedback = session.tools[0].parameters.properties.v;
  assert.ok(feedback.required.includes('r'));
  assert.equal(feedback.properties.r.type, 'string');
  assert.equal(feedback.properties.r.maxLength, 240);
  assert.equal(session.tools[0].parameters.properties.r.description, 'rewrite');
  Socket.instance.event({ type: 'error', error: { code: 'synthetic_failure' } });
  await assert.rejects(promise, /synthetic_failure/);
});

test("synthetic better version remains under 60 words without banned phrases through missing-fact gap handling", async () => {
  const rewrite = "I'm asking for a 12% raise. We agreed I'd resolve 30 tickets. Compared with our agreement, I don't know yet.";
  const promise = scoreAudio(Socket, 'synthetic', new Uint8Array(4800));
  Socket.instance.event({ type: 'response.done', response: { status: 'completed', output: [{
    type: 'function_call', name: 'submit_practice_result', arguments: JSON.stringify({
      u: false, p: '12%', g: 'Resolve 30 tickets', d: '', e: "I don't know",
      v: { c:[{p:true,e:'raise'},{p:true,e:'goal'},{p:true,e:'raise'},{p:false,e:'repeated'}], ...checkedFeedback(80,90) }, n: 'Clear articulation; respectful tone.', r: rewrite,
    }),
  }] } });
  const result = parsePracticeResult(await promise, undefined, false,
    { confidence: 84, heard: 'Heard: 2 fillers, 1 long pause, 0 hedges' },
    { askedFacts: ['deliveredOutcome'] });
  assert.equal(result.question, null);
  assert.ok(result.score.rewrite.includes('[add your outcome here]'));
  assert.ok(result.score.rewrite.trim().split(/\s+/u).length < 60);
  assert.doesNotMatch(result.score.rewrite, /i wanted to take a moment|\bleverag\w*|\balign\w*/iu);
  assert.ok(result.score.rewrite.startsWith(rewrite));
});
test("monthly quota errors reject with their code and close the socket", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  Socket.instance.event({
    type: "error",
    error: { code: "insufficient_quota" },
  });
  await assert.rejects(promise, /insufficient_quota/);
  assert.equal(Socket.instance.closed, true);
});
test("WebSocket HTTP rejection retains only status as diagnostics and keeps the Busy error mapping", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  let drained = false;
  Socket.instance.emit(
    "unexpected-response",
    {},
    {
      statusCode: 401,
      resume() {
        drained = true;
      },
    },
  );
  await assert.rejects(promise, (error) => {
    assert.equal(error.message, "connection_failed");
    assert.equal(error.diagnosticCode, "connection_http_401");
    return true;
  });
  assert.equal(drained, true);
  assert.equal(Socket.instance.closed, true);
});
test("incomplete model output is not accepted as a score", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  Socket.instance.event({
    type: "response.done",
    response: { status: "incomplete", output: [] },
  });
  await assert.rejects(promise, /incomplete_response/);
});
test("a provider that never responds times out and closes the connection", async () => {
  await assert.rejects(
    scoreAudio(Socket, "synthetic", new Uint8Array(4800), 5),
    /timeout/,
  );
  assert.equal(Socket.instance.closed, true);
});
test("Realtime is required to submit a score tool and its arguments feed the existing validator", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  const socket = Socket.instance;
  socket.event({ type: "session.created" });
  const session = socket.sent[0].session;
  assert.deepEqual(session.tool_choice, {
    type: "function",
    name: "submit_practice_result",
  });
  assert.equal(session.tools[0].name, "submit_practice_result");
  socket.event({ type: "input_audio_buffer.committed" });
  assert.deepEqual(
    socket.sent.at(-1).response.tool_choice,
    session.tool_choice,
  );
  const result = {
    u: false, p: "10%", g: "sales goal", d: "met goal", e: "met",
    v: {c:[{p:true,e:'raise'},{p:true,e:'goal'},{p:true,e:'raise'},{p:false,e:'repeated'}],...checkedFeedback(98,90)},
    r: "A synthetic raise request.",
  };
  assert.ok(session.instructions.includes("No chat message, preamble, explanation, thinking aloud"));
  assert.deepEqual(session.tools[0].parameters.required, ["u", "p", "g", "d", "e", "v", "n", "r"]);
  socket.event({
    type: "response.done",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "submit_practice_result",
          arguments: JSON.stringify(result),
        },
      ],
    },
  });
  assert.equal(parsePracticeResult(await promise, undefined, false, {transcript:"I ask for a raise based on our goal.",confidence:84,heard:"Heard: 2 fillers, 1 long pause, 0 hedges"}).score.overall, 90);
});
test("an ordinary prose response cannot be accepted as a structured score", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  Socket.instance.event({
    type: "response.done",
    response: {
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "text", text: "Here is some made-up feedback." }],
        },
      ],
    },
  });
  await assert.rejects(promise, /missing_result_tool/);
});

test("each audio call receives remembered facts and the actual missing-fact question", async () => {
  const context = { facts: { payRequest: "10%", agreedGoals: "Finish by Friday", deliveredOutcome: "", expectations: "" }, currentQuestion: "What outcome did you deliver?" };
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800), 55000, context);
  Socket.instance.event({ type: "session.created" });
  const session = Socket.instance.sent[0].session;
  assert.ok(session.instructions.endsWith(JSON.stringify(context)));
  for (const name of Object.keys(context.facts)) {
    assert.equal(session.tools[0].parameters.properties[FACT_WIRE[name]].type, "string");
    assert.ok(session.tools[0].parameters.required.includes(FACT_WIRE[name]));
  }
  assert.equal(session.tools[0].parameters.properties.v.type, "object");
  assert.ok(session.instructions.includes("Never return null or omit a required field"));
  Socket.instance.event({ type: "error", error: { code: "synthetic_failure" } });
  await assert.rejects(promise, /synthetic_failure/);
});

test("incomplete output carries the provider reason and token count without extra response data", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  Socket.instance.event({
    type: "response.done",
    response: {
      status: "incomplete",
      status_details: { type: "incomplete", reason: "max_output_tokens", private: "synthetic-secret" },
      usage: { output_tokens: 500, private: "synthetic-audio" },
      output: [{ type: "function_call", arguments: '{"unreadable":false,"' }],
    },
  });
  await assert.rejects(promise, error => {
    assert.equal(error.message, "incomplete_response");
    assert.deepEqual(error.completionMetadata, {
      status: "incomplete",
      status_details: { type: "incomplete", reason: "max_output_tokens" },
      usage: { output_tokens: 500 },
    });
    assert.equal(error.rejectedResponseText, '{"unreadable":false,"');
    return true;
  });
});

test("scoring uses minimal reasoning while retaining the 500-token cap", async () => {
  const promise = scoreAudio(Socket, "synthetic", new Uint8Array(4800));
  Socket.instance.event({type:"session.created"});
  assert.deepEqual(Socket.instance.sent.at(-1).session.reasoning,{effort:"minimal"});
  assert.equal(Socket.instance.sent.at(-1).session.max_output_tokens,500);
  Socket.instance.event({type:"input_audio_buffer.committed"});
  assert.deepEqual(Socket.instance.sent.at(-1).response.reasoning,{effort:"minimal"});
  assert.equal(Socket.instance.sent.at(-1).response.max_output_tokens,500);
  Socket.instance.event({type:"error",error:{code:"synthetic_failure"}});
  await assert.rejects(promise,/synthetic_failure/);
});

test("feedback receives every round transcript and earlier audio observations without reusing earlier audio",async()=>{
 const round={askedFacts:['deliveredOutcome'],notes:[{messageId:'first',transcript:'I request 12 percent; resolved 40 tickets.',audioFeedback:'Hesitant pacing; respectful tone.'},{messageId:'second',transcript:'Our target was 30 tickets.'}]};
 const context={round};
 const promise=scoreAudio(Socket,'synthetic',new Uint8Array(4800),55000,context);
 Socket.instance.event({type:'session.created'});
 const session=Socket.instance.sent[0].session;
 assert.ok(session.instructions.includes('Before extracting facts, reread ALL supplied round-note transcripts'));
 assert.ok(session.instructions.includes(round.notes[0].transcript));
 assert.ok(session.instructions.includes(round.notes[1].transcript));
 assert.ok(session.instructions.includes(round.notes[0].audioFeedback));
 assert.ok(session.instructions.includes('Earlier audio has been deleted'));
 assert.ok(session.instructions.includes('[add your outcome here]'));
 assert.equal(session.max_output_tokens,500);
 assert.deepEqual(session.tools[0].parameters.properties.n.maxLength,400);
 Socket.instance.event({type:'error',error:{code:'synthetic_failure'}});
 await assert.rejects(promise,/synthetic_failure/);
});
