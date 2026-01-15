import React, { useState, useEffect, useCallback } from 'react';
import { MusicStaff } from '@/components/MusicStaff';
import { MusicStaffCompact } from '@/components/MusicStaffCompact';
import { OudVisualization } from '@/components/OudVisualization';
import { OudVisualizationCompact } from '@/components/OudVisualizationCompact';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Settings, loadSettings, saveSettings } from '@/lib/settings';
import { Note, notesEqual, randomNoteInRange } from '@/lib/noteUtils';
import { audioEngine } from '@/lib/audioEngine';
import { Music, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TargetNote {
  note: Note;
  status: 'pending' | 'correct' | 'incorrect';
  isNew?: boolean;
}

function Index() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [targetNotes, setTargetNotes] = useState<TargetNote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [isMuted, setIsMuted] = useState(false);
  const [isLandscapeMode, setIsLandscapeMode] = useState(false);
  const [lastPlayedNote, setLastPlayedNote] = useState<Note | null>(null);
  
  // Initialize target notes
  useEffect(() => {
    generateNewNotes();
  }, [settings.notesPerLine, settings.lowestNote, settings.highestNote, settings.includeAccidentals]);
  
  // Save settings to localStorage
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  
  const generateNewNotes = useCallback(() => {
    const notes: TargetNote[] = [];
    for (let i = 0; i < settings.notesPerLine; i++) {
      notes.push({
        note: randomNoteInRange(settings.lowestNote, settings.highestNote, settings.includeAccidentals),
        status: 'pending',
      });
    }
    setTargetNotes(notes);
    setCurrentIndex(0);
  }, [settings.notesPerLine, settings.lowestNote, settings.highestNote, settings.includeAccidentals]);
  
  const handleNotePlayed = useCallback((playedNote: Note) => {
    if (currentIndex >= targetNotes.length) return;
    
    const currentTargetNote = targetNotes[currentIndex];
    const isCorrect = notesEqual(playedNote, currentTargetNote.note);
    
    if (isCorrect) {
      setTargetNotes(prev => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], status: 'correct' };
        return updated;
      });
      
      setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
      
      if (!isMuted) {
        audioEngine.playSuccess();
      }
      
      setTimeout(() => {
        setTargetNotes(prev => {
          const remaining = prev.slice(1);
          const newNote: TargetNote = {
            note: randomNoteInRange(settings.lowestNote, settings.highestNote, settings.includeAccidentals),
            status: 'pending',
            isNew: true,
          };
          return [...remaining, newNote];
        });
        
        setTimeout(() => {
          setTargetNotes(prev => prev.map(n => ({ ...n, isNew: false })));
        }, 300);
      }, 400);
      
    } else {
      setTargetNotes(prev => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], status: 'incorrect' };
        return updated;
      });
      
      setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
      
      if (!isMuted) {
        audioEngine.playError();
      }
      
      setTimeout(() => {
        setTargetNotes(prev => {
          const updated = [...prev];
          updated[currentIndex] = { ...updated[currentIndex], status: 'pending' };
          return updated;
        });
      }, 400);
    }
  }, [currentIndex, targetNotes, isMuted, settings.lowestNote, settings.highestNote, settings.includeAccidentals]);
  
  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
  }, []);
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
    audioEngine.setVolume(isMuted ? 0.5 : 0);
    toast(isMuted ? 'Sound enabled' : 'Sound muted');
  };
  
  const handleReset = () => {
    generateNewNotes();
    setScore({ correct: 0, incorrect: 0 });
    setLastPlayedNote(null);
    toast.success('New practice session started!');
  };

  const toggleLandscapeMode = () => {
    setIsLandscapeMode(!isLandscapeMode);
    toast(isLandscapeMode ? 'Standard mode' : 'Landscape mode enabled');
  };

  // Landscape mode layout
  if (isLandscapeMode) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background flex flex-col">
        {/* Minimal header */}
        <header className="h-10 flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Oud Trainer</span>
            <span className="text-xs text-success ml-2">✓ {score.correct}</span>
            <span className="text-xs text-destructive">✗ {score.incorrect}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs px-2">
              New
            </Button>
            <Button variant="outline" size="icon" onClick={toggleMute} className="h-7 w-7">
              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </Button>
            <Button 
              variant="default" 
              size="icon" 
              onClick={toggleLandscapeMode} 
              className="h-7 w-7"
            >
              <Smartphone className="h-3 w-3" />
            </Button>
            <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />
          </div>
        </header>
        
        {/* Main content - horizontal split */}
        <main className="flex-1 flex min-h-0">
          {/* Music staff - 20% */}
          <section className="w-[20%] flex-shrink-0 p-2 border-r border-border">
            <MusicStaffCompact 
              targetNotes={targetNotes}
              currentIndex={currentIndex}
              notationSystem={settings.notationSystem}
            />
          </section>
          
          {/* Oud - 80% (75% oud + 5% right panel handled inside) */}
          <section className="flex-1 p-2">
            <OudVisualizationCompact 
              settings={settings} 
              onNotePlayed={handleNotePlayed}
              lastPlayedNote={lastPlayedNote}
              onLastPlayedNoteChange={setLastPlayedNote}
            />
          </section>
        </main>
      </div>
    );
  }
  
  // Standard layout
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Music className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-foreground">Oud Note Trainer</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Learn to read and play</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Score Display */}
            <div className="hidden sm:flex items-center gap-4 mr-4 text-sm">
              <span className="text-success font-medium">✓ {score.correct}</span>
              <span className="text-destructive font-medium">✗ {score.incorrect}</span>
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleLandscapeMode} 
              className="h-10 w-10"
              title="Landscape mode"
            >
              <Smartphone className="h-5 w-5" />
            </Button>
            
            <Button variant="outline" size="icon" onClick={toggleMute} className="h-10 w-10">
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            
            <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Musical Staff Section */}
        <section className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-serif font-semibold text-foreground">Sheet Music</h2>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              New Session
            </Button>
          </div>
          <MusicStaff 
            targetNotes={targetNotes}
            currentIndex={currentIndex}
            notationSystem={settings.notationSystem}
          />
        </section>
        
        {/* Mobile Score */}
        <div className="sm:hidden flex justify-center gap-6 text-sm">
          <span className="text-success font-medium">✓ Correct: {score.correct}</span>
          <span className="text-destructive font-medium">✗ Wrong: {score.incorrect}</span>
        </div>
        
        {/* Oud Section */}
        <section className="flex-1 min-h-0">
          <h2 className="text-lg font-serif font-semibold text-foreground mb-3">Oud</h2>
          <div className="bg-card rounded-xl p-4 sm:p-6 border border-border shadow-lg">
            <OudVisualization 
              settings={settings} 
              onNotePlayed={handleNotePlayed}
            />
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        <p>Tap the oud strings to play notes. Match the notes shown on the staff!</p>
      </footer>
    </div>
  );
}

export default Index;
