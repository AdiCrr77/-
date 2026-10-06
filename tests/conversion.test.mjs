import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { convertAudio } from "../scripts/worker.mjs";

test("real ffmpeg converts synthetic Opus and reports corrupt media without exposing stderr", async (t) => {
  let ffmpeg = process.env.PRACTICE_FFMPEG ?? "ffmpeg";
  if (spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status !== 0)
    ffmpeg = path.join(
      homedir(),
      ".hermes/tools/ffmpeg-9.0.1-linux-x64/bin/ffmpeg",
    );
  if (spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status !== 0) {
    t.skip("ffmpeg is not installed");
    return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "synthetic-opus-"));
  const file = path.join(directory, "tone.ogg");
  try {
    const create = spawnSync(
      ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-c:a",
        "libopus",
        file,
      ],
      { stdio: "ignore" },
    );
    assert.equal(create.status, 0);
    await access(file);
    const pcm = await convertAudio(ffmpeg, file);
    assert.equal(pcm.length, 24000 * 2);
    assert.ok(pcm.some((byte) => byte !== 0));
    pcm.fill(0);
    const invalid = path.join(directory, "invalid.ogg");
    await writeFile(invalid, "synthetic invalid media");
    await assert.rejects(convertAudio(ffmpeg, invalid), (error) => {
      assert.equal(error.message, "conversion_failed");
      assert.equal(error.diagnosticCode, "audio_decode_invalid");
      return true;
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
