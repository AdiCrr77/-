import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { validIdentity, MAX_PCM_BYTES, BUSY, UNREADABLE } from "./lib/rules.js";
import { reportDiagnostic } from "./lib/diagnostics.js";

const http = httpRouter();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
function authorized(request) {
  const secret = process.env.PRACTICE_BRIDGE_TOKEN;
  return secret && request.headers.get("Authorization") === `Bearer ${secret}`;
}
http.route({
  path: "/practice/prepare",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
    try {
      const raw = await request.text();
      if (raw.length > 4096) return json({ error: "Too large" }, 413);
      const { phone, messageId, text } = JSON.parse(raw);
      if (
        !validIdentity(phone, messageId) ||
        typeof text !== "string" ||
        text.length > 1000
      )
        return json({ error: "Invalid message" }, 400);
      return json(
        await ctx.runMutation(internal.practice.prepare, {
          phone,
          messageId,
          text,
        }),
      );
    } catch (error) {
      reportDiagnostic(error);
      return json({ ready: false, messages: [BUSY] }, 503);
    }
  }),
});
http.route({
  path: "/practice/score",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
    const phone = request.headers.get("X-Practice-Phone");
    const messageId = request.headers.get("X-Practice-Message");
    if (!validIdentity(phone, messageId))
      return json({ error: "Invalid message" }, 400);
    if (request.headers.get("Content-Type") !== "application/octet-stream")
      return json({ error: "PCM required" }, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Audio required" }, 400);
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PCM_BYTES) {
          value.fill(0);
          await reader.cancel();
          await ctx.runMutation(internal.practice.finish, {
            phone,
            messageId,
            messages: [UNREADABLE],
            score: null,
          });
          return json({ messages: [UNREADABLE] }, 413);
        }
        chunks.push(value);
      }
      const audio = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        audio.set(chunk, offset);
        offset += chunk.length;
        chunk.fill(0);
      }
      try {
        return json({
          messages: await ctx.runAction(internal.scoring.score, {
            phone,
            messageId,
            audio: audio.buffer,
          }),
        });
      } finally {
        audio.fill(0);
      }
    } catch (error) {
      reportDiagnostic(error);
      return json({ messages: [BUSY] }, 503);
    } finally {
      for (const chunk of chunks) chunk.fill(0);
      reader.releaseLock();
    }
  }),
});
export default http;
