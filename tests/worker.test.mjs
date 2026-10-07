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

test('successful voice diagnostics print locally once and never become WhatsApp messages',async()=>{
 const cacheDir=await mkdtemp(path.join(tmpdir(),'synthetic-local-diagnostic-'));
 const file=path.join(cacheDir,'fake.ogg');await writeFile(file,'synthetic');
 const sends=[],printed=[];
 const scoringDiagnostic='SCORING DIAGNOSTIC\n{"fullTranscript":"Um, synthetic answer.","words":[{"word":"Um","start":3,"end":3.2}],"biggestGaps":[],"fillers":[{"word":"Um"}],"longPauses":[],"hedges":[],"r":"Check 2 lowered Clarity because the delivered result is missing."}\nEND SCORING DIAGNOSTIC';
 try {
 const worker=createWorker({site:'https://synthetic.convex.site',token:'synthetic',bridge:'http://127.0.0.1:3001',cacheDir,convert:async()=>Buffer.alloc(4800),logDiagnostic:block=>printed.push(block),fetchImpl:async(url,options)=>{
 if(url.endsWith('/send')){sends.push(JSON.parse(options.body).message);return{ok:true,json:async()=>({success:true})};}
 if(url.endsWith('/prepare'))return{ok:true,json:async()=>({ready:true,messages:[]})};
 return{ok:true,json:async()=>({messages:['synthetic score','synthetic rewrite'],scoringDiagnostic})};
 }});
 await worker({senderId:'15555550123@s.whatsapp.net',chatId:'15555550123@s.whatsapp.net',messageId:'FAKE-DIAGNOSTIC',mediaType:'ptt',mediaUrls:[file],isGroup:false});
 assert.deepEqual(printed,[scoringDiagnostic]);
 assert.deepEqual(sends,['Listening to your answer...','synthetic score','synthetic rewrite']);
 assert.ok(printed[0].includes('Check 2 lowered Clarity'));
 assert.ok(sends.every(message=>!message.includes('Check 2 lowered Clarity')));
 await assert.rejects(access(file));
 } finally {await rm(cacheDir,{recursive:true,force:true});}
});

test('missing inbound audio sends the resend message and prints only safe bridge details without scoring',async()=>{
 const sends=[],printed=[],requests=[];
 const worker=createWorker({site:'https://synthetic.convex.site',token:'synthetic-secret-token',bridge:'http://127.0.0.1:3001',cacheDir:'/tmp/unused-synthetic-cache',logDiagnostic:line=>printed.push(line),convert:async()=>assert.fail('missing audio must not convert'),fetchImpl:async(url,options)=>{
 requests.push(url);
 if(url.endsWith('/prepare'))return{ok:true,json:async()=>({ready:true,messages:[]})};
 assert.ok(url.endsWith('/send'),'missing audio must not call scoring');
 sends.push(JSON.parse(options.body).message);return{ok:true,json:async()=>({success:true})};
 }});
 await worker({senderId:'15555550123@s.whatsapp.net',chatId:'15555550123@s.whatsapp.net',messageId:'FAKE-MISSING',mediaType:'ptt',mediaUrls:[],body:'[audio could not be downloaded]',audioDownloadError:{name:'TypeError',message:'fetch failed https://media.invalid/private?token=synthetic-secret-token sk-synthetic-key',cause:{name:'Error',code:'ENOTFOUND',message:'private URL and credentials',status:503},url:'https://media.invalid/private'}});
 assert.equal(sends.at(-1),"I couldn't get that voice note, please send it again.");
 assert.ok(!requests.some(url=>url.endsWith('/score')));
 assert.equal(printed.length,1);
 assert.ok(printed[0].includes('audio_download_missing'));
 assert.ok(printed[0].includes('[audio could not be downloaded]'));
 assert.ok(printed[0].includes('TypeError'));assert.ok(printed[0].includes('ENOTFOUND'));assert.ok(printed[0].includes('503'));
 for(const forbidden of ['https://','synthetic-secret-token','sk-synthetic-key','private','15555550123'])assert.ok(!printed[0].includes(forbidden));
});
test('missing audio without bridge error detail reports detail unavailable',async()=>{
 const printed=[],sends=[];
 const worker=createWorker({site:'https://synthetic.convex.site',token:'synthetic',bridge:'http://127.0.0.1:3001',cacheDir:'/tmp/unused-synthetic-cache',logDiagnostic:line=>printed.push(line),fetchImpl:async(url,options)=>{
 if(url.endsWith('/prepare'))return{ok:true,json:async()=>({ready:true,messages:[]})};
 assert.ok(url.endsWith('/send'));sends.push(JSON.parse(options.body).message);return{ok:true,json:async()=>({success:true})};
 }});
 await worker({senderId:'15555550123@s.whatsapp.net',chatId:'15555550123@s.whatsapp.net',messageId:'FAKE-NO-DETAIL',mediaType:'audio',mediaUrls:[]});
 assert.ok(printed[0].includes('Bridge supplied no error detail'));
 assert.equal(sends.at(-1),"I couldn't get that voice note, please send it again.");
});
