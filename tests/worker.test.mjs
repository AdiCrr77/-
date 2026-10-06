import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorker } from "../scripts/worker.mjs";

for (const failure of [false, true])
  test(`voice note is deleted after ${failure ? "conversion failure" : "successful scoring"}`, async () => {
    const cacheDir = await mkdtemp(
      path.join(tmpdir(), "synthetic-practice-test-"),
    );
    const file = path.join(cacheDir, "fake.ogg");
    await writeFile(file, "made-up bytes, not a recording");
    const sends = [];
    const diagnostics = [];
    const previousWarn = console.warn;
    console.warn = (line) => diagnostics.push(line);
    let original;
    try {
      const worker = createWorker({
        site: "https://synthetic.convex.site",
        token: "synthetic",
        bridge: "http://127.0.0.1:3001",
        cacheDir,
        convert: async () => {
          if (failure) throw new Error("synthetic_failure");
          return Buffer.alloc(4800, 3);
        },
        fetchImpl: async (url, options) => {
          if (url.endsWith("/send")) {
            sends.push(JSON.parse(options.body).message);
            return { ok: true, json: async () => ({ success: true }) };
          }
          if (url.endsWith("/prepare"))
            return {
              ok: true,
              json: async () => ({ ready: true, messages: [] }),
            };
          original = Buffer.from(options.body);
          return {
            ok: true,
            json: async () => ({
              messages: failure
                ? ["I couldn't hear that clearly. Send it again?"]
                : ["synthetic score", "synthetic rewrite"],
            }),
          };
        },
      });
      await worker({
        senderId: "15555550123@s.whatsapp.net",
        chatId: "15555550123@s.whatsapp.net",
        messageId: "FAKE-ID",
        mediaType: "ptt",
        mediaUrls: [file],
        isGroup: false,
      });
      assert.equal(sends[0], "Listening to your answer...");
      assert.equal(original.length, failure ? 0 : 4800);
      assert.equal(sends.length, failure ? 2 : 3);
      assert.deepEqual(
        diagnostics,
        failure ? ["practice_scoring_error code=audio_conversion_failed"] : [],
      );
      await assert.rejects(access(file));
    } finally {
      console.warn = previousWarn;
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
test("duplicate voice event is discarded and its temporary file deleted without conversion", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "synthetic-duplicate-"));
  const file = path.join(cacheDir, "fake.ogg");
  await writeFile(file, "made-up");
  try {
    const worker = createWorker({
      site: "https://synthetic.convex.site",
      token: "synthetic",
      bridge: "http://127.0.0.1:3001",
      cacheDir,
      convert: async () => assert.fail("duplicate must not decode or score"),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ ready: false, messages: [] }),
      }),
    });
    await worker({
      senderId: "15555550123@s.whatsapp.net",
      chatId: "15555550123@s.whatsapp.net",
      messageId: "FAKE",
      mediaType: "ptt",
      mediaUrls: [file],
    });
    await assert.rejects(access(file));
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});
