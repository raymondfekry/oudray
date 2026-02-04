import React, { useState, useEffect, useCallback } from 'react';
import { MusicStaff } from '@/components/MusicStaff';
import { MusicStaffCompact } from '@/components/MusicStaffCompact';
import { OudVisualization } from '@/components/OudVisualization';
import { OudVisualizationCompact } from '@/components/OudVisualizationCompact';
import { SettingsPanel } from '@/components/SettingsPanel';
import { MicLevelIndicator } from '@/components/MicLevelIndicator';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Settings, loadSettings, saveSettings } from '@/lib/settings';
import { Note, notesEqual, randomNoteInRange, noteToMidi } from '@/lib/noteUtils';
import { audioEngine } from '@/lib/audioEngine';
import { Music, Volume2, VolumeX, Smartphone, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { startListening, stopListening } from '@/lib/micPitchDetector';

interface TargetNote {
  note: Note;
  status: 'pending' | 'correct' | 'incorrect';
  isNew?: boolean;
  uid: string;
}

function Index() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [targetNotes, setTargetNotes] = useState<TargetNote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [isMuted, setIsMuted] = useState(false);
  const [isLandscapeMode, setIsLandscapeMode] = useState(false);
  const [lastPlayedNote, setLastPlayedNote] = useState<Note | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveDetectedNote, setLiveDetectedNote] = useState<Note | null>(null);
  const [highlightNote, setHighlightNote] = useState<Note | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<number | null>(null);
  const [lastSuccessNote, setLastSuccessNote] = useState<Note | null>(null);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [micStatus, setMicStatus] = useState<'listening' | 'recovering' | 'error' | 'off'>('off');
  const [micLevel, setMicLevel] = useState(0);
  
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
    let prevNote: Note | undefined = undefined;
    for (let i = 0; i < settings.notesPerLine; i++) {
      const newNote = randomNoteInRange(
        settings.lowestNote, 
        settings.highestNote, 
        settings.includeAccidentals,
        settings.avoidRepetition,
        prevNote
      );
      notes.push({
        note: newNote,
        status: 'pending',
        uid: Math.random().toString(36).slice(2) + Date.now().toString(36),
      });
      prevNote = newNote;
    }
    setTargetNotes(notes);
    setCurrentIndex(0);
  }, [settings.notesPerLine, settings.lowestNote, settings.highestNote, settings.includeAccidentals, settings.avoidRepetition]);
  
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
          const lastNote = remaining.length > 0 ? remaining[remaining.length - 1].note : undefined;
          const newNote: TargetNote = {
            note: randomNoteInRange(
              settings.lowestNote, 
              settings.highestNote, 
              settings.includeAccidentals,
              settings.avoidRepetition,
              lastNote
            ),
            status: 'pending',
            isNew: true,
            uid: Math.random().toString(36).slice(2) + Date.now().toString(36),
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
    setLiveDetectedNote(null);
    setHighlightNote(null);
    setLastSuccessTime(null);
    setLastSuccessNote(null);
    toast.success('New practice session started!');
  };

  const toggleLandscapeMode = () => {
    setIsLandscapeMode(!isLandscapeMode);
    toast(isLandscapeMode ? 'Standard mode' : 'Landscape mode enabled');
  };
  
  const onMicNote = useCallback((note: Note) => {
    setLiveDetectedNote(note);
    setLastPlayedNote(note);
    setHighlightNote(note);
  }, []);
  
  useEffect(() => {
    if (!liveDetectedNote || currentIndex >= targetNotes.length) return;
    const targetNote = targetNotes[currentIndex].note;
    
    // Only process if the current note is pending
    if (targetNotes[currentIndex].status === 'pending' && notesEqual(liveDetectedNote, targetNote)) {
      const now = Date.now();
      
      // Check if this is a repeated note scenario
      if (lastSuccessNote && notesEqual(liveDetectedNote, lastSuccessNote) && lastSuccessTime) {
        const elapsed = now - lastSuccessTime;
        // If we haven't waited long enough, skip this detection
        if (elapsed < settings.repeatNoteBufferMs) {
          return;
        }
      }
      
      handleNotePlayed(liveDetectedNote);
      setLastSuccessTime(now);
      setLastSuccessNote(liveDetectedNote);
      setLiveDetectedNote(null); // Consume the event to prevent re-triggering
    }
  }, [liveDetectedNote, currentIndex, targetNotes, handleNotePlayed, lastSuccessNote, lastSuccessTime, settings.repeatNoteBufferMs]);
  
  const onMicStatus = useCallback((status: 'listening' | 'recovering' | 'error', level: number) => {
    setMicStatus(status);
    setMicLevel(level);
    if (status === 'recovering') {
      toast.info('Mic recovering...', { id: 'mic-recovery' });
    }
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      setMicStatus('off');
      setMicLevel(0);
      // Release wake lock
      if (wakeLock) {
        await wakeLock.release();
        setWakeLock(null);
      }
      toast('Mic stopped');
      return;
    }
    try {
      await startListening(onMicNote, { 
        minStableMs: settings.micDebounceMs,
        onStatus: onMicStatus,
        autoRecoveryTimeoutMs: 5000
      });
      setIsListening(true);
      setMicStatus('listening');
      // Request wake lock to keep screen on
      if ('wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
          lock.addEventListener('release', () => setWakeLock(null));
        } catch (err) {
          console.warn('Wake Lock not available:', err);
        }
      }
      toast('Listening...');
    } catch (e) {
      setMicStatus('error');
      toast.error('Microphone access denied');
    }
  };
  
  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isListening && !wakeLock) {
        if ('wakeLock' in navigator) {
          try {
            const lock = await navigator.wakeLock.request('screen');
            setWakeLock(lock);
            lock.addEventListener('release', () => setWakeLock(null));
          } catch (err) {
            console.warn('Wake Lock re-acquire failed:', err);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isListening, wakeLock]);

  // Landscape mode layout
  if (isLandscapeMode) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col">
        <ResizablePanelGroup direction="vertical" className="flex-1">
          <ResizablePanel defaultSize={30} minSize={20}>
            <header className="border-b border-border bg-card/50 backdrop-blur-sm flex h-full items-center justify-between px-2 py-1 gap-2">
              <div className="flex-1 min-w-0 max-w-[50%] h-full">
                <MusicStaffCompact 
                  targetNotes={targetNotes}
                  currentIndex={currentIndex}
                  notationSystem={settings.notationSystem}
                />
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-success">✓ {score.correct}</span>
                  <span className="text-destructive">✗ {score.incorrect}</span>
                </div>
                
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 text-xs px-2">
                  New
                </Button>
                <Button variant="outline" size="icon" onClick={toggleMute} className="h-6 w-6">
                  {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </Button>
                <Button 
                  variant="default" 
                  size="icon" 
                  onClick={toggleLandscapeMode} 
                  className="h-6 w-6"
                >
                  <Smartphone className="h-3 w-3" />
                </Button>
              <Button 
                variant={isListening ? "default" : "outline"} 
                size="icon" 
                onClick={toggleListening} 
                className="h-6 w-6"
                title="Mic"
              >
                {isListening ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              </Button>
              {isListening && (
                <MicLevelIndicator level={micLevel} status={micStatus} className="hidden sm:flex" />
              )}
            {liveDetectedNote && (
              <div className={`${targetNotes[currentIndex]?.note && notesEqual(liveDetectedNote, targetNotes[currentIndex].note) ? 'bg-success/20 border border-success text-success animate-note-correct' : 'bg-destructive/20 border border-destructive text-destructive animate-note-shake'} px-2 py-0.5 rounded text-xs`}>
                {settings.notationSystem === 'solfege' ? (
                  <span>
                    {liveDetectedNote.letter === 'C' ? 'Do' :
                     liveDetectedNote.letter === 'D' ? 'Re' :
                     liveDetectedNote.letter === 'E' ? 'Mi' :
                     liveDetectedNote.letter === 'F' ? 'Fa' :
                     liveDetectedNote.letter === 'G' ? 'Sol' :
                     liveDetectedNote.letter === 'A' ? 'La' : 'Si'}
                    {liveDetectedNote.accidental === '#' ? '♯' : liveDetectedNote.accidental === 'b' ? '♭' : ''}{liveDetectedNote.octave}
                  </span>
                ) : (
                  <span>
                    {liveDetectedNote.letter}{liveDetectedNote.accidental === '#' ? '♯' : liveDetectedNote.accidental === 'b' ? '♭' : ''}{liveDetectedNote.octave}
                  </span>
                )}
              </div>
            )}
                <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />
              </div>
            </header>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={40}>
            <div className="h-full p-1">
              <OudVisualizationCompact 
                settings={settings} 
                onNotePlayed={handleNotePlayed}
                lastPlayedNote={lastPlayedNote}
                onLastPlayedNoteChange={setLastPlayedNote}
                highlightNote={highlightNote}
                expectedNote={targetNotes[currentIndex]?.note}
            currentStatus={targetNotes[currentIndex]?.status}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
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
            
            <InstallPrompt className="h-10 w-10" />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleLandscapeMode} 
              className="h-10 w-10"
              title="Landscape mode"
            >
              <Smartphone className="h-5 w-5" />
            </Button>
            <Button 
              variant={isListening ? "default" : "outline"} 
              size="icon" 
              onClick={toggleListening} 
              className="h-10 w-10"
              title="Microphone"
            >
              {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            {isListening && (
              <MicLevelIndicator level={micLevel} status={micStatus} />
            )}
            {liveDetectedNote && (
              <div className={`${targetNotes[currentIndex]?.note && notesEqual(liveDetectedNote, targetNotes[currentIndex].note) ? 'bg-success/20 border border-success text-success animate-note-correct' : 'bg-destructive/20 border border-destructive text-destructive animate-note-shake'} px-2 py-1 rounded text-sm`}>
                {settings.notationSystem === 'solfege' ? (
                  <span>
                    {liveDetectedNote.letter === 'C' ? 'Do' :
                     liveDetectedNote.letter === 'D' ? 'Re' :
                     liveDetectedNote.letter === 'E' ? 'Mi' :
                     liveDetectedNote.letter === 'F' ? 'Fa' :
                     liveDetectedNote.letter === 'G' ? 'Sol' :
                     liveDetectedNote.letter === 'A' ? 'La' : 'Si'}
                    {liveDetectedNote.accidental === '#' ? '♯' : liveDetectedNote.accidental === 'b' ? '♭' : ''}{liveDetectedNote.octave}
                  </span>
                ) : (
                  <span>
                    {liveDetectedNote.letter}{liveDetectedNote.accidental === '#' ? '♯' : liveDetectedNote.accidental === 'b' ? '♭' : ''}{liveDetectedNote.octave}
                  </span>
                )}
              </div>
            )}
            
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
              externalLastPlayedNote={liveDetectedNote}
              highlightNote={highlightNote}
              expectedNote={targetNotes[currentIndex]?.note}
              currentStatus={targetNotes[currentIndex]?.status}
            />
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        <p>Tap the oud strings to play notes or use the mic. Match the notes shown on the staff!</p>
      </footer>
    </div>
  );
}

export default Index;
