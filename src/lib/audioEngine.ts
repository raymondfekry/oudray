// Web Audio API synthesizer for playing notes

import { Note, noteToFrequency } from './noteUtils';

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  private initContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);
    }
    
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
  
  // Play a note with a simple plucked string envelope
  playNote(note: Note, duration: number = 0.8): void {
    this.playFrequency(noteToFrequency(note), duration);
  }
  
  // Play a frequency with envelope
  playFrequency(frequency: number, duration: number = 0.8): void {
    this.initContext();
    
    if (!this.audioContext || !this.masterGain) return;
    
    const now = this.audioContext.currentTime;
    
    // Create oscillators for a richer oud-like sound
    const fundamental = this.audioContext.createOscillator();
    const harmonic1 = this.audioContext.createOscillator();
    const harmonic2 = this.audioContext.createOscillator();
    
    fundamental.type = 'triangle';
    harmonic1.type = 'sine';
    harmonic2.type = 'sine';
    
    fundamental.frequency.value = frequency;
    harmonic1.frequency.value = frequency * 2; // First harmonic
    harmonic2.frequency.value = frequency * 3; // Second harmonic
    
    // Gain nodes for mixing
    const fundamentalGain = this.audioContext.createGain();
    const harmonic1Gain = this.audioContext.createGain();
    const harmonic2Gain = this.audioContext.createGain();
    
    fundamentalGain.gain.value = 0.6;
    harmonic1Gain.gain.value = 0.25;
    harmonic2Gain.gain.value = 0.1;
    
    // Envelope node
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;
    
    // Plucked string envelope: quick attack, medium decay
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + 0.01); // Attack: 10ms
    envelope.gain.exponentialRampToValueAtTime(0.3, now + 0.1); // Initial decay
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration); // Sustain decay
    
    // Connect everything
    fundamental.connect(fundamentalGain);
    harmonic1.connect(harmonic1Gain);
    harmonic2.connect(harmonic2Gain);
    
    fundamentalGain.connect(envelope);
    harmonic1Gain.connect(envelope);
    harmonic2Gain.connect(envelope);
    
    envelope.connect(this.masterGain);
    
    // Start and stop
    fundamental.start(now);
    harmonic1.start(now);
    harmonic2.start(now);
    
    fundamental.stop(now + duration);
    harmonic1.stop(now + duration);
    harmonic2.stop(now + duration);
  }
  
  // Play a success sound
  playSuccess(): void {
    this.initContext();
    if (!this.audioContext || !this.masterGain) return;
    
    const now = this.audioContext.currentTime;
    
    // High pitched "ding"
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }
  
  // Play an error sound
  playError(): void {
    this.initContext();
    if (!this.audioContext || !this.masterGain) return;
    
    const now = this.audioContext.currentTime;
    
    // Low pitched "buzz"
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = 150;
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }
  
  // Set master volume (0-1)
  setVolume(volume: number): void {
    this.initContext();
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.5;
    }
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();
