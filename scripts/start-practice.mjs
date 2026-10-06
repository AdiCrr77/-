import { spawn, spawnSync } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createWorker, poll } from "./worker.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {}
const site =
  process.env.CONVEX_SITE_URL ??
  process.env.VITE_CONVEX_URL?.replace(/\.convex\.cloud$/, ".convex.site");
const token = process.env.PRACTICE_BRIDGE_TOKEN;
if (!site || !token)
  throw new Error("Run npm run practice:setup before starting the bridge.");
if (!/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site))
  throw new Error("A Convex HTTPS site URL is required.");
const bridgeFile =
  process.env.HERMES_PRACTICE_BRIDGE ??
  path.join(
    homedir(),
    ".hermes/hermes-agent/scripts/whatsapp-bridge/bridge.js",
  );
const session =
  process.env.HERMES_PRACTICE_SESSION ??
  path.join(homedir(), ".hermes/whatsapp/session");
await access(bridgeFile);
const bundledFfmpeg = path.join(
  homedir(),
  ".hermes/tools/ffmpeg-9.0.1-linux-x64/bin/ffmpeg",
);
let ffmpeg = process.env.PRACTICE_FFMPEG ?? "ffmpeg";
if (
  !process.env.PRACTICE_FFMPEG &&
  spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status !== 0
)
  ffmpeg = bundledFfmpeg;
if (spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status !== 0)
  throw new Error(
    "ffmpeg is required in WSL. Install it, then run practice:start again.",
  );
for (const port of [3000, 3001]) {
  try {
    await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    continue;
  }
  throw new Error(
    "An existing WhatsApp bridge is running. Stop the Hermes WhatsApp gateway before starting practice.",
  );
}
const bridge = "http://127.0.0.1:3001";
const cacheDir = await mkdtemp(path.join(tmpdir(), "raise-practice-"));
const controller = new AbortController();
const child = spawn(
  process.execPath,
  [bridgeFile, "--port", "3001", "--session", session],
  {
    // Hermes may print QR codes, but no inbound event/debug logging is enabled.
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      WHATSAPP_MODE: "self-chat",
      WHATSAPP_REPLY_PREFIX: "",
      WHATSAPP_DEBUG: "false",
      WHATSAPP_SEND_READ_RECEIPTS: "false",
      HERMES_AUDIO_CACHE_DIR: cacheDir,
      HERMES_IMAGE_CACHE_DIR: cacheDir,
      HERMES_DOCUMENT_CACHE_DIR: cacheDir,
    },
  },
);
const exited = new Promise((resolve) => {
  child.once("exit", resolve);
  child.once("error", resolve);
});
child.once("error", () => controller.abort());
const stop = () => {
  controller.abort();
  child.kill("SIGTERM");
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("exit", () => controller.abort());
try {
  let connected = false;
  for (let tries = 0; tries < 120 && !controller.signal.aborted; tries++) {
    try {
      connected =
        (await (await fetch(`${bridge}/health`)).json()).status === "connected";
    } catch {}
    if (connected) break;
    await sleep(1000);
  }
  if (!connected)
    throw new Error(
      "WhatsApp pairing did not finish. Check the bridge terminal and retry.",
    );
  console.log(
    "Practice connected. On your phone, open Message yourself, send 1, then a voice note under 90 seconds.",
  );
  await poll(
    createWorker({ site, token, bridge, cacheDir, ffmpeg }),
    bridge,
    controller.signal,
  );
} finally {
  stop();
  const killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
  await exited;
  clearTimeout(killTimer);
  await rm(cacheDir, { recursive: true, force: true });
}
