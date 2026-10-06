import { randomBytes } from "node:crypto";
import { readFile, appendFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// Convex holds the OpenAI key. Only a separate bridge credential is stored locally.
const env = await readFile(".env.local", "utf8");
if (!/^CONVEX_DEPLOYMENT=/m.test(env))
  throw new Error(
    "Existing Convex deployment is required; setup will not rebind it.",
  );
const existing = env.match(/^PRACTICE_BRIDGE_TOKEN=(.+)$/m)?.[1]?.trim();
const token = existing ?? randomBytes(32).toString("hex");
const set = spawnSync(
  "npx",
  ["convex", "env", "set", "PRACTICE_BRIDGE_TOKEN"],
  {
    input: token,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
    env: { ...process.env, CONVEX_DISABLE_TELEMETRY: "1" },
  },
);
if (set.status !== 0) {
  console.error(
    "Cannot configure the bridge token. Check network access and Convex login; no credential was printed.",
  );
  process.exit(1);
}
if (!existing)
  await appendFile(".env.local", `\nPRACTICE_BRIDGE_TOKEN=${token}\n`);
console.log("Bridge token configured for the existing development deployment.");
const push = spawnSync("npx", ["convex", "dev", "--once"], {
  stdio: "inherit",
});
process.exit(push.status ?? 1);
