import { MAX_PCM_BYTES } from "./rules.js";

const SAFE_CODES = new Set([
  "missing_openai_key",
  "stale_session",
  "invalid_transcription",
  "transcription_failed",
  "call_limit_reached",
  "invalid_audio",
  "invalid_audio_empty",
  "invalid_audio_too_short",
  "invalid_audio_too_long",
  "invalid_audio_odd_length",
  "audio_download_missing",
  "audio_conversion_failed",
  "audio_conversion_timeout",
  "audio_converter_missing",
  "audio_input_missing",
  "audio_decode_invalid",
  "audio_decoder_missing",
  "audio_stream_missing",
  "audio_converter_runtime_failed",
  "invalid_json",
  "missing_result_tool",
  "invalid_json_empty",
  "invalid_json_fenced",
  "invalid_json_non_object",
  "invalid_json_incomplete_object",
  "invalid_json_malformed_object",
  "invalid_scores",
  "invalid_scores_missing",
  "invalid_scores_type",
  "invalid_scores_range",
  "invalid_facts",
  "invalid_rewrite",
  "invalid_rewrite_missing",
  "invalid_rewrite_empty",
  "invalid_rewrite_length",
  "invalid_rewrite_format",
  "invalid_rewrite_fields",
  "invalid_rewrite_word_limit",
  "invalid_rewrite_corporate_phrase",
  "unreadable",
  "timeout",
  "connection_failed",
  "connection_closed",
  "invalid_response",
  "incomplete_response",
  "provider_error",
  "invalid_api_key",
  "model_not_found",
  "model_not_available",
  "permission_denied",
  "invalid_request_error",
  "unknown_parameter",
  "missing_required_parameter",
  "unsupported_value",
  "invalid_value",
  "rate_limit_exceeded",
  "insufficient_quota",
  "billing_hard_limit_reached",
  "monthly_budget_exceeded",
  "server_error",
  "input_audio_buffer_commit_empty",
  "response_create_error",
  "connection_EAI_AGAIN",
  "connection_ENOTFOUND",
  "connection_ECONNREFUSED",
  "connection_ECONNRESET",
  "connection_ETIMEDOUT",
  "connection_CERT_HAS_EXPIRED",
  ...[400, 401, 403, 404, 408, 429, 500, 502, 503, 504].map(
    (status) => `connection_http_${status}`,
  ),
]);

export function audioFailureCode(bytes) {
  if (bytes.byteLength === 0) return "invalid_audio_empty";
  if (bytes.byteLength < 4800) return "invalid_audio_too_short";
  if (bytes.byteLength > MAX_PCM_BYTES) return "invalid_audio_too_long";
  if (bytes.byteLength % 2 !== 0) return "invalid_audio_odd_length";
  return "invalid_audio";
}

// Fixed-code diagnostics remain separate from explicitly requested rejected-response text.
export function reportDiagnostic(error, write = (line) => console.warn(line)) {
  const candidate = error?.diagnosticCode ?? error?.message;
  const code =
    error instanceof SyntaxError
      ? "invalid_json"
      : SAFE_CODES.has(candidate)
        ? candidate
        : "unknown_error";
  write(`practice_scoring_error code=${code}`);
  if (error?.completionMetadata) {
    const metadata = error.completionMetadata;
    const fixed = (value, allowed) => allowed.includes(value) ? value : "unknown";
    const status = fixed(metadata.status, ["completed", "incomplete", "failed", "cancelled", "in_progress"]);
    const type = fixed(metadata.status_details?.type, ["completed", "incomplete", "failed", "cancelled"]);
    const reason = fixed(metadata.status_details?.reason, ["max_output_tokens", "content_filter", "turn_detected", "client_cancelled"]);
    const count = metadata.usage?.output_tokens;
    const tokens = Number.isSafeInteger(count) && count >= 0 ? count : "unknown";
    write(`practice_scoring_completion status=${status} type=${type} reason=${reason} output_tokens=${tokens}`);
    if (error.tokenBreakdown) {
      const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : "unknown";
      const b = error.tokenBreakdown;
      write(`practice_scoring_tokens text=${safeCount(b.text)} audio=${safeCount(b.audio)} reasoning=${safeCount(b.reasoning)}`);
    }
  }
}

// Explicitly requested debugging: text only, with credentials and audio payloads removed.
export function reportRejectedResponse(text, secrets = [], write = (line) => console.warn(line)) {
  let safe = String(text);
  for (const secret of secrets.filter(Boolean)) safe = safe.split(secret).join("[REDACTED KEY]");
  safe = safe.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED KEY]");
  safe = safe.replace(/"(?:audio|audio_base64|input_audio)"\s*:\s*"[^"\\]*(?:\\.[^"\\]*)*"/gi, '"audio":"[REDACTED AUDIO]"');
  safe = safe.replace(/[A-Za-z0-9+/]{256,}={0,2}/g, "[REDACTED BINARY]");
  write(`practice_scoring_rejected_response ${JSON.stringify(safe)}`);
}
