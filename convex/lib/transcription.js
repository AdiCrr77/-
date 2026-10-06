import { transcriptionRejection, reportRejectedTranscription } from "./transcriptionDiagnostics.js";
import { measureWords } from './confidence.js';
import { validAudio } from './rules.js';
export const TRANSCRIPTION_PROMPT = 'Um, uh, I think, maybe, umm, sort of. Uh, I would like to discuss a raise. Um, perhaps we can talk about it.';
export async function transcribeAudio(key, bytes, fetchImpl=fetch, write=line=>console.warn(line)) {
  const duration=bytes.length/48000;
  const reject = (words, error) => {
    reportRejectedTranscription(words, error, duration, [key, process.env.PRACTICE_BRIDGE_TOKEN], write);
    throw error;
  };
  if (!validAudio(bytes)) reject(null, transcriptionRejection('audio_valid'));
  // Original mono 24kHz PCM wrapped as WAV in memory; no file storage or logs.
  const wav=Buffer.alloc(44+bytes.length);
  wav.write('RIFF',0); wav.writeUInt32LE(36+bytes.length,4); wav.write('WAVE',8);
  wav.write('fmt ',12); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20);
  wav.writeUInt16LE(1,22); wav.writeUInt32LE(24000,24); wav.writeUInt32LE(48000,28);
  wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36);
  wav.writeUInt32LE(bytes.length,40); wav.set(bytes,44);
  let body;
  try {
    body=new FormData();
    body.append('file',new Blob([wav],{type:'audio/wav'}),'voice.wav');
    body.append('model','whisper-1'); body.append('response_format','verbose_json');
    body.append('timestamp_granularities[]','word'); body.append('temperature','0');
    body.append('prompt',TRANSCRIPTION_PROMPT);
    let response;
    try { response=await fetchImpl('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body,signal:AbortSignal.timeout(15000)}); }
    catch { throw new Error('transcription_failed'); }
    if (!response.ok) {
      let code; try { code=(await response.json())?.error?.code; } catch {}
      throw new Error(['insufficient_quota','billing_hard_limit_reached','monthly_budget_exceeded'].includes(code)?code:'transcription_failed');
    }
    let result; try {result=await response.json();} catch {reject(null, transcriptionRejection('response_json'));}
    if (Array.isArray(result?.words) && !result.words.length) reject(result.words, transcriptionRejection('words_nonempty', -1, 'unreadable'));
    try { return measureWords(result?.words,duration); }
    catch (error) { reject(result?.words, error); }
  } finally { wav.fill(0); body?.delete('file'); }
}
