import { Note } from './noteUtils';
import { midiToNote } from './noteUtils';

type DetectCallback = (note: Note) => void;
type StatusCallback = (status: 'listening' | 'recovering' | 'error', rmsLevel: number) => void;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let keepAliveGain: GainNode | null = null;
let mediaStream: MediaStream | null = null;
let rafId: number | null = null;
let callbackRef: DetectCallback | null = null;
let statusCallbackRef: StatusCallback | null = null;
let lastEmittedMidi: number | null = null;
let candidateMidi: number | null = null;
let candidateStartTs: number | null = null;
let minStableMs = 250;
let lowRmsSince: number | null = null;
let rearmMs = 120;
let rearmRmsThresh = 0.012;

// Auto-recovery tracking
let lastAudioDetectedAt: number = 0;
let autoRecoveryTimeoutMs = 5000;
let isRecovering = false;
let currentRmsLevel = 0;

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

// Check if MediaStreamTrack is still alive
function isTrackAlive(): boolean {
  if (!mediaStream) return false;
  const tracks = mediaStream.getAudioTracks();
  if (tracks.length === 0) return false;
  return tracks[0].readyState === 'live';
}

// Attempt to restart the microphone
async function restartMicrophone(): Promise<boolean> {
  if (!callbackRef) return false;
  
  isRecovering = true;
  statusCallbackRef?.('recovering', currentRmsLevel);
  
  try {
    // Stop existing stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    if (analyser) {
      analyser.disconnect();
    }
    if (keepAliveGain) {
      keepAliveGain.disconnect();
    }
    
    // Get new stream
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
    });
    
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    
    const src = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    
    // Keep the graph alive
    keepAliveGain = audioContext.createGain();
    keepAliveGain.gain.value = 0;
    analyser.connect(keepAliveGain);
    keepAliveGain.connect(audioContext.destination);
    
    // Add track ended listener
    const track = mediaStream.getAudioTracks()[0];
    track.onended = () => {
      console.warn('[MicPitchDetector] Track ended, will attempt recovery');
      restartMicrophone();
    };
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    lastAudioDetectedAt = performance.now();
    isRecovering = false;
    statusCallbackRef?.('listening', currentRmsLevel);
    console.log('[MicPitchDetector] Microphone restarted successfully');
    return true;
  } catch (err) {
    console.error('[MicPitchDetector] Failed to restart microphone:', err);
    isRecovering = false;
    statusCallbackRef?.('error', 0);
    return false;
  }
}

function tick() {
  if (!analyser || !audioContext || !callbackRef) return;

  // On mobile, the AudioContext can get suspended unexpectedly
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {});
  }

  const bufferLength = 2048;
  const timeData = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(timeData);
  const now = performance.now();
  
  let rms = 0;
  for (let i = 0; i < bufferLength; i++) rms += timeData[i] * timeData[i];
  rms = Math.sqrt(rms / bufferLength);
  currentRmsLevel = rms;
  
  // Check if track is still alive
  if (!isTrackAlive() && !isRecovering) {
    console.warn('[MicPitchDetector] Track died, attempting recovery');
    restartMicrophone().then(() => {
      rafId = requestAnimationFrame(tick);
    });
    return;
  }
  
  // Auto-recovery: if no audio above threshold for too long, restart
  if (rms > 0.01) {
    lastAudioDetectedAt = now;
  } else if (!isRecovering && now - lastAudioDetectedAt > autoRecoveryTimeoutMs) {
    console.warn('[MicPitchDetector] No audio detected for 5s, attempting recovery');
    restartMicrophone().then(() => {
      rafId = requestAnimationFrame(tick);
    });
    return;
  }
  
  // Report status
  statusCallbackRef?.(isRecovering ? 'recovering' : 'listening', rms);
  
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

export async function startListening(
  cb: DetectCallback, 
  opts?: { 
    minStableMs?: number; 
    rearmMs?: number; 
    rearmRmsThresh?: number;
    onStatus?: StatusCallback;
    autoRecoveryTimeoutMs?: number;
  }
): Promise<void> {
  callbackRef = cb;
  statusCallbackRef = opts?.onStatus || null;
  autoRecoveryTimeoutMs = opts?.autoRecoveryTimeoutMs ?? 5000;
  
  if (!audioContext) audioContext = new AudioContext();
  mediaStream = await navigator.mediaDevices.getUserMedia({ 
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
  });
  const src = audioContext.createMediaStreamSource(mediaStream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);

  // Keep the graph alive on mobile by routing to destination through a silent gain.
  if (keepAliveGain) {
    try {
      keepAliveGain.disconnect();
    } catch {
      // ignore
    }
  }
  keepAliveGain = audioContext.createGain();
  keepAliveGain.gain.value = 0;
  analyser.connect(keepAliveGain);
  keepAliveGain.connect(audioContext.destination);

  // Add track ended listener for immediate detection
  const track = mediaStream.getAudioTracks()[0];
  track.onended = () => {
    console.warn('[MicPitchDetector] Track ended, will attempt recovery');
    restartMicrophone();
  };

  if (audioContext.state === 'suspended') await audioContext.resume();
  lastEmittedMidi = null;
  candidateMidi = null;
  candidateStartTs = null;
  minStableMs = opts?.minStableMs ?? 250;
  rearmMs = opts?.rearmMs ?? 120;
  rearmRmsThresh = opts?.rearmRmsThresh ?? 0.012;
  lowRmsSince = null;
  lastAudioDetectedAt = performance.now();
  isRecovering = false;
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
  if (keepAliveGain) {
    keepAliveGain.disconnect();
    keepAliveGain = null;
  }
  callbackRef = null;
  statusCallbackRef = null;
  lastEmittedMidi = null;
  candidateMidi = null;
  candidateStartTs = null;
  lowRmsSince = null;
  isRecovering = false;
  currentRmsLevel = 0;
}

// Export current RMS level for external monitoring
export function getCurrentRmsLevel(): number {
  return currentRmsLevel;
}
