import React, { useState, useCallback, useRef } from 'react';
import { Note, formatNoteShort, NotationSystem, noteToMidi, midiToNote } from '@/lib/noteUtils';
import { audioEngine } from '@/lib/audioEngine';
import { Settings, StringConfig } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { Lightbulb, LightbulbOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OudVisualizationCompactProps {
  settings: Settings;
  onNotePlayed: (note: Note) => void;
  lastPlayedNote: Note | null;
  onLastPlayedNoteChange: (note: Note | null) => void;
}

interface TapRipple {
  id: number;
  x: number;
  y: number;
}

const MAX_SEMITONES = 12;

export function OudVisualizationCompact({ 
  settings, 
  onNotePlayed, 
  lastPlayedNote,
  onLastPlayedNoteChange 
}: OudVisualizationCompactProps) {
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [ripples, setRipples] = useState<TapRipple[]>([]);
  const [activeString, setActiveString] = useState<number | null>(null);
  const rippleIdRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const { strings, notationSystem, stringCount } = settings;
  const activeStrings = strings.slice(0, stringCount);
  
  // SVG dimensions - more compact
  const svgWidth = 600;
  const svgHeight = 220;
  const neckStartX = 40;
  const neckEndX = 400;
  const bowlCenterX = 500;
  const bowlWidth = 180;
  const stringStartY = 50;
  const stringEndY = 170;
  const stringSpacing = (stringEndY - stringStartY) / (stringCount - 1);
  
  const fingerboardWidth = neckEndX - neckStartX;
  
  const handleOudClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    let closestString = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < stringCount; i++) {
      const stringY = stringStartY + i * stringSpacing;
      const distance = Math.abs(y - stringY);
      if (distance < minDistance) {
        minDistance = distance;
        closestString = i;
      }
    }
    
    if (minDistance > 25) return;
    
    const stringConfig = activeStrings[closestString];
    const openMidi = noteToMidi(stringConfig.openNote);
    
    let playedNote: Note;
    
    if (x >= neckStartX && x <= neckEndX) {
      const xRatio = (x - neckStartX) / fingerboardWidth;
      const semitoneOffset = Math.round(xRatio * MAX_SEMITONES);
      const playedMidi = openMidi + semitoneOffset;
      playedNote = midiToNote(playedMidi);
    } else if (x > neckEndX) {
      playedNote = stringConfig.openNote;
    } else {
      return;
    }
    
    audioEngine.playNote(playedNote);
    onLastPlayedNoteChange(playedNote);
    
    const rippleId = ++rippleIdRef.current;
    const stringY = stringStartY + closestString * stringSpacing;
    setRipples(prev => [...prev, { id: rippleId, x, y: stringY }]);
    setActiveString(closestString);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== rippleId));
      setActiveString(null);
    }, 300);
    
    onNotePlayed(playedNote);
  }, [activeStrings, stringCount, onNotePlayed, onLastPlayedNoteChange]);
  
  const renderPositionMarkers = () => {
    if (!hintsEnabled) return null;
    
    const markers: JSX.Element[] = [];
    const markerPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    
    markerPositions.forEach((semitone) => {
      const x = neckStartX + (semitone / MAX_SEMITONES) * fingerboardWidth;
      const isEven = semitone % 2 === 0;
      const isOctave = semitone === 12;
      
      markers.push(
        <line
          key={`marker-${semitone}`}
          x1={x}
          y1={stringStartY - 10}
          x2={x}
          y2={stringEndY + 10}
          stroke="hsl(var(--oud-rosette))"
          strokeWidth={isOctave ? 2 : isEven ? 1 : 0.5}
          strokeDasharray={isOctave ? undefined : isEven ? "3,3" : "2,3"}
          opacity={isOctave ? 0.7 : isEven ? 0.5 : 0.25}
        />
      );
      
      markers.push(
        <text
          key={`marker-text-${semitone}`}
          x={x}
          y={stringStartY - 16}
          textAnchor="middle"
          className={isEven ? "fill-foreground" : "fill-muted-foreground/50"}
          fontSize={isEven ? 9 : 7}
          fontWeight={isEven ? 600 : 400}
        >
          {semitone}
        </text>
      );
    });
    
    return markers;
  };
  
  return (
    <div className="relative flex h-full">
      {/* Main Oud SVG - takes most space */}
      <div className="flex-1 min-w-0">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full cursor-pointer oud-shadow"
          onClick={handleOudClick}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="woodGrainCompact" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(30, 50%, 35%)" />
              <stop offset="30%" stopColor="hsl(25, 55%, 30%)" />
              <stop offset="60%" stopColor="hsl(28, 52%, 32%)" />
              <stop offset="100%" stopColor="hsl(25, 50%, 28%)" />
            </linearGradient>
            
            <linearGradient id="neckGrainCompact" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(25, 45%, 22%)" />
              <stop offset="50%" stopColor="hsl(25, 40%, 18%)" />
              <stop offset="100%" stopColor="hsl(25, 45%, 22%)" />
            </linearGradient>
            
            <radialGradient id="rosetteGradCompact" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(25, 30%, 12%)" />
              <stop offset="70%" stopColor="hsl(42, 70%, 50%)" />
              <stop offset="85%" stopColor="hsl(25, 30%, 15%)" />
              <stop offset="100%" stopColor="hsl(42, 60%, 45%)" />
            </radialGradient>
          </defs>
          
          {/* Bowl/body */}
          <ellipse
            cx={bowlCenterX}
            cy={svgHeight / 2}
            rx={bowlWidth / 2}
            ry={75}
            fill="url(#woodGrainCompact)"
          />
          
          {/* Sound hole */}
          <circle
            cx={bowlCenterX - 20}
            cy={svgHeight / 2}
            r={25}
            fill="url(#rosetteGradCompact)"
          />
          <circle
            cx={bowlCenterX - 20}
            cy={svgHeight / 2}
            r={18}
            fill="hsl(25, 30%, 8%)"
          />
          
          {/* Decorative rings */}
          {[20, 23, 27].map((r, i) => (
            <circle
              key={i}
              cx={bowlCenterX - 20}
              cy={svgHeight / 2}
              r={r}
              fill="none"
              stroke="hsl(42, 70%, 55%)"
              strokeWidth={0.75}
              opacity={0.6}
            />
          ))}
          
          {/* Neck */}
          <rect
            x={neckStartX - 8}
            y={stringStartY - 15}
            width={neckEndX - neckStartX + 30}
            height={stringEndY - stringStartY + 30}
            rx={4}
            fill="url(#neckGrainCompact)"
          />
          
          {/* Nut */}
          <rect
            x={neckStartX - 4}
            y={stringStartY - 8}
            width={6}
            height={stringEndY - stringStartY + 16}
            fill="hsl(40, 20%, 85%)"
            rx={2}
          />
          
          {/* Position markers */}
          {renderPositionMarkers()}
          
          {/* Strings */}
          {activeStrings.map((stringConfig, i) => {
            const y = stringStartY + i * stringSpacing;
            const isActive = activeString === i;
            const courseCount = stringConfig.courseCount;
            const courseOffset = courseCount > 1 ? 2 : 0;
            
            return (
              <g key={i}>
                {Array.from({ length: courseCount }).map((_, courseIdx) => {
                  const courseY = y + (courseIdx - (courseCount - 1) / 2) * courseOffset;
                  return (
                    <line
                      key={courseIdx}
                      x1={neckStartX}
                      y1={courseY}
                      x2={bowlCenterX + 60}
                      y2={courseY}
                      stroke={isActive ? "hsl(42, 80%, 70%)" : "hsl(var(--oud-string))"}
                      strokeWidth={isActive ? 2 : 1.2 + (i * 0.15)}
                      className={cn("string-hover transition-all duration-150", isActive && "note-glow")}
                    />
                  );
                })}
                
                {hintsEnabled && (
                  <text
                    x={neckStartX - 18}
                    y={y + 4}
                    textAnchor="middle"
                    className="fill-accent font-semibold"
                    fontSize={10}
                  >
                    {formatNoteShort(stringConfig.openNote, notationSystem)}
                    <tspan fontSize={7}>{stringConfig.openNote.octave}</tspan>
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Tap ripples */}
          {ripples.map(ripple => (
            <circle
              key={ripple.id}
              cx={ripple.x}
              cy={ripple.y}
              r={15}
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              className="animate-tap-ripple"
              opacity={0.8}
            />
          ))}
          
          {/* Bridge */}
          <rect
            x={bowlCenterX + 45}
            y={stringStartY - 4}
            width={20}
            height={stringEndY - stringStartY + 8}
            fill="hsl(25, 40%, 20%)"
            rx={2}
          />
        </svg>
      </div>
      
      {/* Right side panel - hints and played note */}
      <div className="w-24 flex-shrink-0 flex flex-col justify-center gap-3 pl-3">
        <Button
          variant={hintsEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => setHintsEnabled(!hintsEnabled)}
          className="gap-1 text-xs h-8"
        >
          {hintsEnabled ? <Lightbulb className="w-3 h-3" /> : <LightbulbOff className="w-3 h-3" />}
          Hints
        </Button>
        
        {lastPlayedNote && (
          <div className="bg-accent/20 border border-accent rounded-lg px-2 py-2 text-center animate-in fade-in duration-200">
            <div className="text-[10px] text-muted-foreground">Played</div>
            <div className="text-xl font-bold text-accent">
              {formatNoteShort(lastPlayedNote, notationSystem)}{lastPlayedNote.octave}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
