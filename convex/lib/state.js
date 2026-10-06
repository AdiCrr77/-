import { BUSY, OPENER, reserveCall } from "./rules.js";
import { emptyFacts } from "./facts.js";

// Called exclusively inside Convex mutations: deduplication and the global limit are atomic.
export async function prepareDelivery(ctx, { phone, messageId, text }) {
  const prior = await ctx.db
    .query("deliveries")
    .withIndex("by_phone_message", (q) =>
      q.eq("phone", phone).eq("messageId", messageId),
    )
    .unique();
  if (prior) return { ready: false, messages: [] };
  let session = await ctx.db
    .query("sessions")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .unique();
  const selection = ["1", "ask for a raise"].includes(
    text.trim().toLowerCase(),
  );
  const generation = selection ? messageId : (session?.generation ?? messageId);
  let messages = [];
  let ready = false;
  if (selection) {
    if (session)
      await ctx.db.patch(session._id, { generation, awaitingAnswer: true, facts: emptyFacts(), notes: [], askedFacts: [], currentQuestion: OPENER });
    else
      await ctx.db.insert("sessions", {
        phone,
        situation: "raise",
        generation,
        awaitingAnswer: true,
        facts: emptyFacts(),
        currentQuestion: OPENER,
        notes: [], askedFacts: [],
      });
    messages = [OPENER];
  } else if (text === "" && session?.awaitingAnswer) {
    ready = true;
  } else {
    // Only the approved situation is available during milestone 1.
    messages = [
      "Practise your hard conversation before it happens.\n1 Ask for a raise\nReply 1 to start, then answer with a voice note.",
    ];
  }
  await ctx.db.insert("deliveries", {
    phone,
    messageId,
    generation,
    status: ready ? "prepared" : "finished",
    messages,
    createdAt: Date.now(),
  });
  return { ready, messages };
}

export async function claimDelivery(ctx, { phone, messageId }) {
  const delivery = await ctx.db
    .query("deliveries")
    .withIndex("by_phone_message", (q) =>
      q.eq("phone", phone).eq("messageId", messageId),
    )
    .unique();
  if (!delivery || delivery.status !== "prepared")
    return { claimed: false, messages: [] };
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .unique();
  if (!session?.awaitingAnswer || session.generation !== delivery.generation) {
    await ctx.db.patch(delivery._id, { status: "finished" });
    return { claimed: false, messages: [] };
  }
  const limit = await ctx.db
    .query("callLimits")
    .withIndex("by_name", (q) => q.eq("name", "ai"))
    .unique();
  const timestamps = reserveCall(limit?.timestamps ?? [], Date.now());
  if (!timestamps) {
    await ctx.db.patch(delivery._id, { status: "finished", messages: [BUSY] });
    return { claimed: false, messages: [BUSY] };
  }
  if (limit) await ctx.db.patch(limit._id, { timestamps });
  else await ctx.db.insert("callLimits", { name: "ai", timestamps });
  await ctx.db.patch(delivery._id, { status: "processing" });
  // One scored answer per selection, including concurrent different delivery IDs.
  await ctx.db.patch(session._id, { awaitingAnswer: false });
  return { claimed: true, messages: [], facts: session.facts ?? emptyFacts(), currentQuestion: session.currentQuestion ?? OPENER, askedFacts: session.askedFacts ?? [] };
}

export async function finishDelivery(
  ctx,
  { phone, messageId, messages, score, facts, question, askedFact, audioFeedback, discardNote },
) {
  const delivery = await ctx.db
    .query("deliveries")
    .withIndex("by_phone_message", (q) =>
      q.eq("phone", phone).eq("messageId", messageId),
    )
    .unique();
  if (!delivery || delivery.status === "finished") return null;
  const current = await ctx.db.query("sessions").withIndex("by_phone", (q) => q.eq("phone", phone)).unique();
  if (current?.generation !== delivery.generation) {
    await ctx.db.patch(delivery._id, { status: "finished", messages: [] });
    return null;
  }
  let notes=current.notes ?? [];
  if(discardNote) notes=notes.filter(note=>note.messageId!==messageId);
  else if(audioFeedback) notes=notes.map(note=>note.messageId===messageId?{...note,audioFeedback}:note);
  const askedFacts=current.askedFacts ?? [];
  if(askedFact && !askedFacts.includes(askedFact)) askedFacts.push(askedFact);
  await ctx.db.patch(current._id, {notes,askedFacts,...(facts?{facts}:{}),...(question?{currentQuestion:question}:{})});
  if (score) {
    await ctx.db.insert("answers", {
      phone,
      generation: delivery.generation,
      situation: "raise",
      ...score,
      ...(notes.length?{sourceMessageIds:notes.map(note=>note.messageId)}:{}),
    });
    await ctx.db.patch(current._id, {notes:[]});
  } else {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (session?.generation === delivery.generation)
      await ctx.db.patch(session._id, { awaitingAnswer: true });
  }
  await ctx.db.patch(delivery._id, { status: "finished", messages });
  return null;
}

async function reserveAdditional(ctx, { phone, messageId }, field) {
  const delivery = await ctx.db.query("deliveries").withIndex("by_phone_message", (q) => q.eq("phone", phone).eq("messageId", messageId)).unique();
  if (!delivery || delivery.status !== "processing" || delivery[field]) return false;
  const session = await ctx.db.query("sessions").withIndex("by_phone", (q) => q.eq("phone", phone)).unique();
  if (session?.generation !== delivery.generation) return false;
  const limit = await ctx.db.query("callLimits").withIndex("by_name", (q) => q.eq("name", "ai")).unique();
  const timestamps = reserveCall(limit?.timestamps ?? [], Date.now());
  if (!timestamps) return false;
  if (limit) await ctx.db.patch(limit._id, { timestamps });
  else await ctx.db.insert("callLimits", { name: "ai", timestamps });
  await ctx.db.patch(delivery._id, { [field]: true });
  return true;
}

export const reserveRetry = (ctx, identity) => reserveAdditional(ctx, identity, 'retryReserved');
export const reserveFeedback = (ctx, identity) => reserveAdditional(ctx, identity, 'feedbackReserved');

// Persist a successful transcription before feedback, so feedback failures do not
// discard speech already supplied. Stale generations cannot append to a new round.
export async function recordNote(ctx, {phone,messageId,transcript,fillers,longPauses,hedges}) {
  const delivery=await ctx.db.query('deliveries').withIndex('by_phone_message',q=>q.eq('phone',phone).eq('messageId',messageId)).unique();
  const session=await ctx.db.query('sessions').withIndex('by_phone',q=>q.eq('phone',phone)).unique();
  if(!delivery || delivery.status!=='processing' || !session || session.generation!==delivery.generation) return {accepted:false,notes:[],askedFacts:[]};
  if(typeof transcript!=='string'||!transcript.trim()||[fillers,longPauses,hedges].some(n=>!Number.isSafeInteger(n)||n<0)) throw new Error('invalid_transcription');
  const notes=session.notes ?? [];
  if(!notes.some(note=>note.messageId===messageId)) notes.push({messageId,transcript,fillers,longPauses,hedges});
  await ctx.db.patch(session._id,{notes});
  return {accepted:true,notes,askedFacts:session.askedFacts ?? []};
}
