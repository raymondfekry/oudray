// Settings management with localStorage persistence

import { Note, NotationSystem, parseNote } from './noteUtils';

export interface StringConfig {
  openNote: Note;
  courseCount: number; // Number of sub-strings (1 for single, 2 for double course)
}

export interface Settings {
  stringCount: number;
  notationSystem: NotationSystem;
  strings: StringConfig[];
  lowestNote: Note;
  highestNote: Note;
  notesPerLine: number;
  includeAccidentals: boolean;
  micDebounceMs: number;
  repeatNoteBufferMs: number;
}

// Default tuning (low to high pitch, top to bottom on the oud)
const DEFAULT_STRINGS: StringConfig[] = [
  { openNote: { letter: 'F', accidental: '', octave: 2 }, courseCount: 1 }, // String 1 (top, lowest)
  { openNote: { letter: 'A', accidental: '', octave: 2 }, courseCount: 2 }, // String 2
  { openNote: { letter: 'D', accidental: '', octave: 3 }, courseCount: 2 }, // String 3
  { openNote: { letter: 'G', accidental: '', octave: 3 }, courseCount: 2 }, // String 4
  { openNote: { letter: 'C', accidental: '', octave: 4 }, courseCount: 2 }, // String 5
  { openNote: { letter: 'F', accidental: '', octave: 4 }, courseCount: 2 }, // String 6 (bottom, highest)
];

export const DEFAULT_SETTINGS: Settings = {
  stringCount: 6,
  notationSystem: 'solfege',
  strings: DEFAULT_STRINGS,
  lowestNote: { letter: 'G', accidental: '', octave: 2 },
  highestNote: { letter: 'G', accidental: '', octave: 4 },
  notesPerLine: 4,
  includeAccidentals: false,
  micDebounceMs: 250,
  repeatNoteBufferMs: 1000,
};

const STORAGE_KEY = 'oud-note-trainer-settings';

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle missing properties
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        strings: parsed.strings || DEFAULT_SETTINGS.strings,
        lowestNote: parsed.lowestNote || DEFAULT_SETTINGS.lowestNote,
        highestNote: parsed.highestNote || DEFAULT_SETTINGS.highestNote,
      };
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings to localStorage:', e);
  }
}

// Validate that lowest < highest
export function validateNoteRange(lowest: Note, highest: Note): boolean {
  const lowMidi = (lowest.octave + 1) * 12 + 
    ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[lowest.letter] || 0);
  const highMidi = (highest.octave + 1) * 12 + 
    ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[highest.letter] || 0);
  return lowMidi < highMidi;
}

// Get all available notes for dropdowns
export function getAllNotes(): { note: Note; display: string }[] {
  const notes: { note: Note; display: string }[] = [];
  const letters: Array<'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'> = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  
  for (let octave = 1; octave <= 6; octave++) {
    for (const letter of letters) {
      notes.push({
        note: { letter, accidental: '', octave },
        display: `${letter}${octave}`,
      });
    }
  }
  
  return notes;
}
