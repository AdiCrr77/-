export const TRANSCRIPTION_RULES = {
  audio_valid: 'validAudio(decoded PCM) must be true',
  response_json: 'response must parse as JSON',
  duration_finite: 'duration must be finite',
  duration_positive: 'duration must be greater than 0',
  duration_limit: 'duration must be at most 90 seconds',
  words_array: 'words must be an array',
  words_nonempty: 'words must contain at least one non-empty word',
  words_limit: 'words.length must be at most 2000',
  word_present: 'word entry must be present',
  word_string: 'word must be a string',
  word_nonempty: 'word.trim() must be nonempty',
  word_length: 'word.length must be at most 200',
  start_finite: 'start must be a finite number',
  end_finite: 'end must be a finite number',
  start_nonnegative: 'start must be at least 0',
  end_after_start: 'end must be at least start',
  end_within_duration: 'end must be at most decoded duration + 0.05 seconds',
  start_order: 'start must be at least the preceding start',
  word_tokens: 'word must contain at least one letter or number',
};
export function transcriptionRejection(rule, index = -1, message = 'invalid_transcription') {
  const error = new Error(message);
  error.transcriptionRule = rule;
  error.transcriptionWordIndex = index;
  return error;
}
export function reportRejectedTranscription(words, error, duration, secrets = [], write = line => console.warn(line)) {
  const clean = value => {
    if (typeof value === 'string') {
      for (const secret of secrets.filter(Boolean)) value = value.split(secret).join('[REDACTED KEY]');
      return value.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED KEY]').replace(/[A-Za-z0-9+/]{256,}={0,2}/g,'[REDACTED BINARY]');
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : `[${String(value)}]`;
    if (value == null || typeof value === 'boolean') return value ?? null;
    return '[INVALID TYPE]';
  };
  const rule = TRANSCRIPTION_RULES[error?.transcriptionRule] ? error.transcriptionRule : 'unknown';
  const index = Number.isInteger(error?.transcriptionWordIndex) ? error.transcriptionWordIndex : -1;
  // Field allowlist: never serialize the response, audio, headers, key or full transcript.
  const projected = Array.isArray(words) ? words.map(item => ({word:clean(item?.word),start:clean(item?.start),end:clean(item?.end)})) : null;
  write(`practice_transcription_rejected ${JSON.stringify({rule,condition:TRANSCRIPTION_RULES[rule]??'unknown',wordIndex:index,duration:Number.isFinite(duration)?duration:null,words:projected})}`);
}
