import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Settings, DEFAULT_SETTINGS, validateNoteRange, getAllNotes } from '@/lib/settings';
import { Note, NotationSystem, formatNote, noteToMidi } from '@/lib/noteUtils';
import { Settings as SettingsIcon, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsPanelProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

const allNotes = getAllNotes();

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const handleStringCountChange = (value: string) => {
    const count = parseInt(value);
    // Ensure we have enough string configs
    const newStrings = [...settings.strings];
    while (newStrings.length < count) {
      newStrings.push({ ...DEFAULT_SETTINGS.strings[newStrings.length] });
    }
    onSettingsChange({ ...settings, stringCount: count, strings: newStrings });
  };
  
  const handleNotationChange = (value: NotationSystem) => {
    onSettingsChange({ ...settings, notationSystem: value });
  };
  
  const handleStringTuningChange = (stringIndex: number, noteStr: string) => {
    const noteInfo = allNotes.find(n => n.display === noteStr);
    if (noteInfo) {
      const newStrings = [...settings.strings];
      newStrings[stringIndex] = { ...newStrings[stringIndex], openNote: noteInfo.note };
      onSettingsChange({ ...settings, strings: newStrings });
    }
  };
  
  const handleCourseCountChange = (stringIndex: number, count: string) => {
    const newStrings = [...settings.strings];
    newStrings[stringIndex] = { ...newStrings[stringIndex], courseCount: parseInt(count) };
    onSettingsChange({ ...settings, strings: newStrings });
  };
  
  const handleRangeChange = (type: 'lowest' | 'highest', noteStr: string) => {
    const noteInfo = allNotes.find(n => n.display === noteStr);
    if (noteInfo) {
      const newSettings = {
        ...settings,
        [type === 'lowest' ? 'lowestNote' : 'highestNote']: noteInfo.note,
      };
      
      if (validateNoteRange(newSettings.lowestNote, newSettings.highestNote)) {
        onSettingsChange(newSettings);
      } else {
        toast.error('Lowest note must be lower than highest note');
      }
    }
  };
  
  const handleNotesPerLineChange = (value: string) => {
    onSettingsChange({ ...settings, notesPerLine: parseInt(value) });
  };
  
  const handleAccidentalsChange = (checked: boolean) => {
    onSettingsChange({ ...settings, includeAccidentals: checked });
  };
  
  const handleMicDebounceChange = (value: string) => {
    const ms = parseInt(value);
    if (!isNaN(ms) && ms >= 0 && ms <= 2000) {
      onSettingsChange({ ...settings, micDebounceMs: ms });
    }
  };
  
  const handleReset = () => {
    onSettingsChange({ ...DEFAULT_SETTINGS });
    toast.success('Settings reset to defaults');
  };
  
  const noteToString = (note: Note) => `${note.letter}${note.octave}`;
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10">
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Settings</SheetTitle>
          <SheetDescription>
            Configure your oud and practice preferences
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Notation System */}
          <div className="space-y-2">
            <Label>Note Notation</Label>
            <Select value={settings.notationSystem} onValueChange={handleNotationChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solfege">Do Re Mi Fa Sol La Si</SelectItem>
                <SelectItem value="letters">A B C D E F G</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Number of Strings */}
          <div className="space-y-2">
            <Label>Number of Strings</Label>
            <Select value={settings.stringCount.toString()} onValueChange={handleStringCountChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 5, 6, 7, 8].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} strings</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Separator />
          
          {/* String Tuning */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">String Tuning</Label>
            <p className="text-sm text-muted-foreground">Top string (1) is lowest pitch</p>
            
            {settings.strings.slice(0, settings.stringCount).map((string, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm w-16 text-muted-foreground">String {index + 1}</span>
                
                <Select 
                  value={noteToString(string.openNote)} 
                  onValueChange={(v) => handleStringTuningChange(index, v)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allNotes.map(n => (
                      <SelectItem key={n.display} value={n.display}>
                        {formatNote(n.note, settings.notationSystem)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={string.courseCount.toString()} 
                  onValueChange={(v) => handleCourseCountChange(index, v)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Single</SelectItem>
                    <SelectItem value="2">Double</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          
          <Separator />
          
          {/* Learning Range */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Learning Range</Label>
            
            <div className="flex items-center gap-3">
              <span className="text-sm w-16 text-muted-foreground">Lowest</span>
              <Select 
                value={noteToString(settings.lowestNote)} 
                onValueChange={(v) => handleRangeChange('lowest', v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allNotes.filter(n => noteToMidi(n.note) < noteToMidi(settings.highestNote)).map(n => (
                    <SelectItem key={n.display} value={n.display}>
                      {formatNote(n.note, settings.notationSystem)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm w-16 text-muted-foreground">Highest</span>
              <Select 
                value={noteToString(settings.highestNote)} 
                onValueChange={(v) => handleRangeChange('highest', v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allNotes.filter(n => noteToMidi(n.note) > noteToMidi(settings.lowestNote)).map(n => (
                    <SelectItem key={n.display} value={n.display}>
                      {formatNote(n.note, settings.notationSystem)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Separator />
          
          {/* Notes per Line */}
          <div className="space-y-2">
            <Label>Notes per Line</Label>
            <Select value={settings.notesPerLine.toString()} onValueChange={handleNotesPerLineChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} notes</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Include Accidentals */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="accidentals-switch">Include Sharps & Flats</Label>
              <p className="text-sm text-muted-foreground">Add ♯ and ♭ notes to practice</p>
            </div>
            <Switch
              id="accidentals-switch"
              checked={settings.includeAccidentals}
              onCheckedChange={handleAccidentalsChange}
            />
          </div>
          
          {/* Avoid Repetition */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="avoid-repetition-switch">Avoid Consecutive Repeats</Label>
              <p className="text-sm text-muted-foreground">Don't show the same note twice in a row</p>
            </div>
            <Switch
              id="avoid-repetition-switch"
              checked={settings.avoidRepetition}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, avoidRepetition: checked })}
            />
          </div>
          
          {/* Mic Debounce */}
          <div className="space-y-2">
            <Label>Mic Debounce (ms)</Label>
            <Select value={settings.micDebounceMs.toString()} onValueChange={handleMicDebounceChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[100, 150, 250, 400, 600, 800].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} ms</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Repeat Note Buffer */}
          <div className="space-y-2">
            <Label>Repeat Note Buffer (ms)</Label>
            <p className="text-xs text-muted-foreground">Wait time before same note counts again</p>
            <Select value={settings.repeatNoteBufferMs.toString()} onValueChange={(v) => onSettingsChange({ ...settings, repeatNoteBufferMs: parseInt(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[200, 300, 400, 500, 750, 1000, 1250, 1500].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} ms</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Separator />
          
          {/* Reset Button */}
          <Button variant="outline" onClick={handleReset} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
