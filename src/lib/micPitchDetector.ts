import { Note } from './noteUtils';
import { midiToNote } from './noteUtils';

type DetectCallback = (note: Note) => void;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let rafId: number | null = null;
let callbackRef: DetectCallback | null = null;
let lastEmittedMidi: number | null = null;
let candidateMidi: number | null = null;
let candidateStartTs: number | null = null;
let minStableMs = 250;
let lowRmsSince: number | null = null;
let rearmMs = 120;
let rearmRmsThresh = 0.012;

function getPitch(buffer: Float32Array, sampleRate: number): number | null {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return null;
  let start = 0;
  for (let i = 0; i < size; i++) {
    if (Math.abs(buffer[i]) > 0.02) {
      start = i;
      break;
    }
  }
  const trimmed = buffer.slice(start);
  const len = trimmed.length;
  const autocorr = new Float32Array(len);
  for (let lag = 0; lag < len; lag++) {
    let sum = 0;
    for (let i = 0; i < len - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    autocorr[lag] = sum;
  }
  let peakIndex = -1;
  let peak = 0;
  for (let i = 1; i < len - 1; i++) {
    if (autocorr[i] > peak && autocorr[i] > autocorr[i - 1] && autocorr[i] > autocorr[i + 1]) {
      peak = autocorr[i];
      peakIndex = i;
    }
  }
  if (peakIndex <= 0) return null;
  const fundamentalPeriod = peakIndex;
  const frequency = sampleRate / fundamentalPeriod;
  if (frequency < 50 || frequency > 2000) return null;
  return frequency;
}

function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function tick() {
  if (!analyser || !audioContext || !callbackRef) return;
  const bufferLength = 2048;
  const timeData = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(timeData);
  const now = performance.now();
  
  let rms = 0;
  for (let i = 0; i < bufferLength; i++) rms += timeData[i] * timeData[i];
  rms = Math.sqrt(rms / bufferLength);
  
  if (rms < rearmRmsThresh) {
    if (lowRmsSince == null) {
      lowRmsSince = now;
    } else if (now - lowRmsSince >= rearmMs) {
      lastEmittedMidi = null;
      candidateMidi = null;
      candidateStartTs = null;
    }
  } else {
    lowRmsSince = null;
  }
  
  const freq = getPitch(timeData, audioContext.sampleRate);
  if (freq) {
    const midi = freqToMidi(freq);
    if (candidateMidi === null || midi !== candidateMidi) {
      candidateMidi = midi;
      candidateStartTs = now;
    } else if (candidateStartTs !== null && now - candidateStartTs >= minStableMs) {
      if (lastEmittedMidi !== midi) {
        lastEmittedMidi = midi;
        callbackRef(midiToNote(midi));
      }
    }
  } else {
    candidateMidi = null;
    candidateStartTs = null;
  }
  rafId = requestAnimationFrame(tick);
}

export async function startListening(cb: DetectCallback, opts?: { minStableMs?: number; rearmMs?: number; rearmRmsThresh?: number }): Promise<void> {
  callbackRef = cb;
  if (!audioContext) audioContext = new AudioContext();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const src = audioContext.createMediaStreamSource(mediaStream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  if (audioContext.state === 'suspended') await audioContext.resume();
  lastEmittedMidi = null;
  candidateMidi = null;
  candidateStartTs = null;
  minStableMs = opts?.minStableMs ?? 250;
  rearmMs = opts?.rearmMs ?? 120;
  rearmRmsThresh = opts?.rearmRmsThresh ?? 0.012;
  lowRmsSince = null;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

export function stopListening(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }
  callbackRef = null;
  lastEmittedMidi = null;
  candidateMidi = null;
  candidateStartTs = null;
  lowRmsSince = null;
}
