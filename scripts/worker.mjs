import { spawn } from "node:child_process";
import { realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { reportDiagnostic } from "../convex/lib/diagnostics.js";

const BUSY = "Busy right now. Try again in a few minutes.";
const UNREADABLE = "I couldn't hear that clearly. Send it again?";

export function convertAudio(ffmpeg, filePath) {
  return new Promise((resolve, reject) => {
    // Decode slightly beyond the limit so Convex can reject long recordings; never truncate to a valid answer.
    const child = spawn(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-i",
        filePath,
        "-t",
        "90.1",
        "-ac",
        "1",
        "-ar",
        "24000",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks = [];
    // Inspect a bounded error privately; emit only a fixed code, never stderr or a path.
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      if (errorText.length < 4096)
        errorText += chunk.toString().slice(0, 4096 - errorText.length);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 30000);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (cause) => {
      clearTimeout(timer);
      const error = new Error("conversion_failed");
      error.diagnosticCode =
        cause.code === "ENOENT"
          ? "audio_converter_missing"
          : "audio_conversion_failed";
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        for (const chunk of chunks) chunk.fill(0);
        const error = new Error("conversion_failed");
        error.diagnosticCode = timedOut
          ? "audio_conversion_timeout"
          : /error while loading shared libraries/i.test(errorText)
            ? "audio_converter_runtime_failed"
            : /No such file or directory/i.test(errorText)
              ? "audio_input_missing"
              : /Invalid data found when processing input|Error parsing|Invalid .*header|End of file/i.test(
                    errorText,
                  )
                ? "audio_decode_invalid"
                : /Decoder .*not found|Unknown decoder|Decoding requested.*no decoder/i.test(
                      errorText,
                    )
                  ? "audio_decoder_missing"
                  : /does not contain any stream|matches no streams/i.test(
                        errorText,
                      )
                    ? "audio_stream_missing"
                    : "audio_conversion_failed";
        reject(error);
      } else {
        const bytes = Buffer.concat(chunks);
        for (const chunk of chunks) chunk.fill(0);
        resolve(bytes);
      }
    });
  });
}

// Never print arbitrary bridge error strings: messages can contain signed media
// URLs or credentials. Keep only known names/codes, numeric statuses and fixed notes.
function missingAudioDiagnostic(event) {
  const names = new Set(['Error', 'TypeError', 'FetchError', 'AbortError', 'TimeoutError', 'AggregateError', 'HTTPError', 'AxiosError', 'Boom']);
  const codes = new Set(['ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'ABORT_ERR', 'ERR_NETWORK', 'ERR_CANCELED', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET']);
  const project = (error, depth = 0) => {
    if (!error || depth > 3) return undefined;
    const value = {};
    if (names.has(error.name)) value.name = error.name;
    if (codes.has(error.code)) value.code = error.code;
    const status = error.status ?? error.statusCode ?? error.output?.statusCode ?? error.response?.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) value.status = status;
    if (typeof error.message === 'string' && /\bfetch failed\b/i.test(error.message)) value.message = 'fetch failed';
    const cause = project(error.cause, depth + 1);
    if (cause) value.cause = cause;
    return Object.keys(value).length ? value : undefined;
  };
  const supplied = event.audioDownloadError ?? event.downloadError ?? event.mediaError ?? event.error;
  const error = project(supplied);
  const note = typeof event.body === 'string' && /\[audio could not be downloaded\]/.test(event.body)
    ? '[audio could not be downloaded]' : undefined;
  return `practice_scoring_error code=audio_download_missing bridge_detail=${JSON.stringify({
    ...(note ? {note} : {}), ...(error ? {error} : {}),
    ...(!note && !error ? {note:'Bridge supplied no error detail'} : {}),
  })}`;
}

export function createWorker({
  site,
  token,
  bridge,
  cacheDir,
  ffmpeg = "ffmpeg",
  fetchImpl = fetch,
  convert = convertAudio,
  logDiagnostic = block => console.log(block),
}) {
  const request = async (url, options = {}) => {
    const response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(85000),
    });
    if (!response.ok) throw new Error("request_failed");
    return response.json();
  };
  const send = async (chatId, messages) => {
    for (const message of messages)
      await request(`${bridge}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message }),
      });
  };
  return async (event) => {
    let mediaPath;
    let bytes;
    try {
      if (["ptt", "audio"].includes(event.mediaType) && event.mediaUrls?.[0]) {
        const candidate = await realpath(event.mediaUrls[0]);
        const root = await realpath(cacheDir);
        if (!candidate.startsWith(root + path.sep))
          throw new Error("unsafe_media_path");
        mediaPath = candidate;
      }
      if (event.isGroup) return;
      // Read the explicit phone JID. LID-only identity is never silently treated as a phone number.
      const match = /^([1-9]\d{6,14})(?::\d+)?@s\.whatsapp\.net$/.exec(
        event.senderId ?? "",
      );
      if (!match || !event.messageId || !event.chatId) return;
      const voice = ["ptt", "audio"].includes(event.mediaType);
      const identity = { phone: match[1], messageId: event.messageId };
      const prepared = await request(`${site}/practice/prepare`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...identity,
          text: voice ? "" : (event.body ?? ""),
        }),
      });
      await send(event.chatId, prepared.messages);
      if (!prepared.ready) return;
      await send(event.chatId, ["Listening to your answer..."]);
      if (mediaPath) {
        try {
          bytes = await convert(ffmpeg, mediaPath);
        } catch (error) {
          reportDiagnostic(
            new Error(error.diagnosticCode ?? "audio_conversion_failed"),
          );
          bytes = Buffer.alloc(0);
        }
      } else {
        try { logDiagnostic(missingAudioDiagnostic(event)); } catch {
          console.error('practice_scoring_error code=audio_download_missing');
        }
        await send(event.chatId, ["I couldn't get that voice note, please send it again."]);
        return;
      }
      const response = await fetchImpl(`${site}/practice/score`, {
        method: "POST",
        signal: AbortSignal.timeout(85000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-Practice-Phone": identity.phone,
          "X-Practice-Message": identity.messageId,
        },
        body: bytes,
      });
      // A rejected overlong recording is unreadable; it never gets an AI call.
      const result =
        response.status === 413
          ? { messages: [UNREADABLE] }
          : response.ok
            ? await response.json()
            : { messages: [BUSY] };
      if(typeof result.scoringDiagnostic==='string') {
        // Local diagnostic output is independent of WhatsApp message delivery.
        try {logDiagnostic(result.scoringDiagnostic);} catch {console.error('Scoring diagnostic could not be printed.');}
      }
      await send(event.chatId, result.messages);
    } catch {
      // Never log real events, audio, phone numbers, answers or credentials.
      console.error(
        "Practice delivery failed. Check bridge and Convex connectivity.",
      );
      if (event.chatId && !event.isGroup)
        await send(event.chatId, [BUSY]).catch(() => {});
    } finally {
      bytes?.fill(0);
      if (mediaPath) await unlink(mediaPath).catch(() => {});
    }
  };
}

export async function poll(worker, bridge, signal) {
  while (!signal.aborted) {
    try {
      const response = await fetch(`${bridge}/messages`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("bridge_unavailable");
      for (const event of await response.json()) {
        if (signal.aborted) break;
        await worker(event);
      }
    } catch {
      console.error("Bridge unavailable; retrying.");
    }
    await sleep(750, undefined, { signal }).catch(() => {});
  }
}
