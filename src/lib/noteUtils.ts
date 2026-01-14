// Note representation and utilities for the Oud Note Trainer

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b';
export type NotationSystem = 'letters' | 'solfege';

export interface Note {
  letter: NoteLetter;
  accidental: Accidental;
  octave: number;
}

// Solfege names mapping
const SOLFEGE_MAP: Record<NoteLetter, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const LETTER_ORDER: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Semitones from C for each letter (within an octave)
const SEMITONES_FROM_C: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Convert note to MIDI number (C4 = 60)
export function noteToMidi(note: Note): number {
  const baseSemitones = SEMITONES_FROM_C[note.letter];
  const accidentalOffset = note.accidental === '#' ? 1 : note.accidental === 'b' ? -1 : 0;
  return (note.octave + 1) * 12 + baseSemitones + accidentalOffset;
}

// Convert MIDI number to note (prefer sharps)
export function midiToNote(midi: number): Note {
  const octave = Math.floor(midi / 12) - 1;
  const semitone = midi % 12;
  
  // Map semitones to natural notes with sharps
  const semitonesMap: { letter: NoteLetter; accidental: Accidental }[] = [
    { letter: 'C', accidental: '' },
    { letter: 'C', accidental: '#' },
    { letter: 'D', accidental: '' },
    { letter: 'D', accidental: '#' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '' },
    { letter: 'F', accidental: '#' },
    { letter: 'G', accidental: '' },
    { letter: 'G', accidental: '#' },
    { letter: 'A', accidental: '' },
    { letter: 'A', accidental: '#' },
    { letter: 'B', accidental: '' },
  ];
  
  const { letter, accidental } = semitonesMap[semitone];
  return { letter, accidental, octave };
}

// Convert MIDI to frequency (A4 = 440Hz)
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Convert note to frequency
export function noteToFrequency(note: Note): number {
  return midiToFrequency(noteToMidi(note));
}

// Format note for display
export function formatNote(note: Note, system: NotationSystem): string {
  const baseName = system === 'solfege' ? SOLFEGE_MAP[note.letter] : note.letter;
  const accidentalSymbol = note.accidental === '#' ? '♯' : note.accidental === 'b' ? '♭' : '';
  return `${baseName}${accidentalSymbol}${note.octave}`;
}

// Format note without octave
export function formatNoteShort(note: Note, system: NotationSystem): string {
  const baseName = system === 'solfege' ? SOLFEGE_MAP[note.letter] : note.letter;
  const accidentalSymbol = note.accidental === '#' ? '♯' : note.accidental === 'b' ? '♭' : '';
  return `${baseName}${accidentalSymbol}`;
}

// Parse note string (e.g., "Sol3", "G3", "F#4")
export function parseNote(noteStr: string): Note | null {
  // Try solfege first
  const solfegeMatch = noteStr.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(♯|♭|#|b)?(\d)$/i);
  if (solfegeMatch) {
    const solfegeName = solfegeMatch[1];
    const accidental = solfegeMatch[2];
    const octave = parseInt(solfegeMatch[3]);
    
    const letter = Object.entries(SOLFEGE_MAP).find(
      ([_, sol]) => sol.toLowerCase() === solfegeName.toLowerCase()
    )?.[0] as NoteLetter;
    
    if (letter) {
      return {
        letter,
        accidental: accidental === '♯' || accidental === '#' ? '#' : accidental === '♭' || accidental === 'b' ? 'b' : '',
        octave,
      };
    }
  }
  
  // Try letter notation
  const letterMatch = noteStr.match(/^([A-Ga-g])(♯|♭|#|b)?(\d)$/);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase() as NoteLetter;
    const accidental = letterMatch[2];
    const octave = parseInt(letterMatch[3]);
    
    return {
      letter,
      accidental: accidental === '♯' || accidental === '#' ? '#' : accidental === '♭' || accidental === 'b' ? 'b' : '',
      octave,
    };
  }
  
  return null;
}

// Check if two notes are equal
export function notesEqual(a: Note, b: Note): boolean {
  return noteToMidi(a) === noteToMidi(b);
}

// Generate a random note within a range (inclusive)
export function randomNoteInRange(lowNote: Note, highNote: Note): Note {
  const lowMidi = noteToMidi(lowNote);
  const highMidi = noteToMidi(highNote);
  const randomMidi = lowMidi + Math.floor(Math.random() * (highMidi - lowMidi + 1));
  return midiToNote(randomMidi);
}

// Get all notes in range
export function getNotesInRange(lowNote: Note, highNote: Note): Note[] {
  const lowMidi = noteToMidi(lowNote);
  const highMidi = noteToMidi(highNote);
  const notes: Note[] = [];
  
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    notes.push(midiToNote(midi));
  }
  
  return notes;
}

// Get staff position for a note (relative to middle line B4)
// Returns number of steps from middle line (positive = up, negative = down)
export function getStaffPosition(note: Note): number {
  // B4 is on the middle line of treble clef
  // Each step is a line or space
  const noteIndex = LETTER_ORDER.indexOf(note.letter);
  const b4Index = LETTER_ORDER.indexOf('B');
  
  // Calculate position relative to B4
  const octaveDiff = note.octave - 4;
  const letterDiff = noteIndex - b4Index;
  
  return octaveDiff * 7 + letterDiff;
}

// Check if note needs ledger lines and how many
export function getLedgerLines(note: Note): { above: number; below: number } {
  const position = getStaffPosition(note);
  
  // Staff spans from E4 (position -4) to F5 (position +4)
  // Below E4 needs ledger lines, above F5 needs ledger lines
  const above = position > 5 ? Math.floor((position - 5) / 2) : 0;
  const below = position < -5 ? Math.floor((-5 - position) / 2) : 0;
  
  return { above, below };
}
