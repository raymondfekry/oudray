import React, { useState, useCallback, useRef } from 'react';
import { Note, formatNoteShort, NotationSystem, noteToMidi, midiToNote } from '@/lib/noteUtils';
import { audioEngine } from '@/lib/audioEngine';
import { Settings, StringConfig } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { Lightbulb, LightbulbOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OudVisualizationProps {
  settings: Settings;
  onNotePlayed: (note: Note) => void;
}

interface TapRipple {
  id: number;
  x: number;
  y: number;
}

const MAX_SEMITONES = 12; // Maximum semitones across fingerboard

export function OudVisualization({ settings, onNotePlayed }: OudVisualizationProps) {
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [ripples, setRipples] = useState<TapRipple[]>([]);
  const [activeString, setActiveString] = useState<number | null>(null);
  const rippleIdRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const { strings, notationSystem, stringCount } = settings;
  const activeStrings = strings.slice(0, stringCount);
  
  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 300;
  const neckStartX = 50;
  const neckEndX = 520;
  const bowlCenterX = 650;
  const bowlWidth = 280;
  const stringStartY = 80;
  const stringEndY = 220;
  const stringSpacing = (stringEndY - stringStartY) / (stringCount - 1);
  
  // Fingerboard width (where notes are played)
  const fingerboardWidth = neckEndX - neckStartX;
  
  const handleOudClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Find closest string
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
    
    // Check if click is within string area (within 25px of a string)
    if (minDistance > 25) return;
    
    const stringConfig = activeStrings[closestString];
    const openMidi = noteToMidi(stringConfig.openNote);
    
    let playedNote: Note;
    
    // Determine if click is on fingerboard (left) or strumming area (right)
    if (x >= neckStartX && x <= neckEndX) {
      // Fingerboard area - calculate semitone offset
      const xRatio = (x - neckStartX) / fingerboardWidth;
      const semitoneOffset = Math.round(xRatio * MAX_SEMITONES);
      const playedMidi = openMidi + semitoneOffset;
      playedNote = midiToNote(playedMidi);
    } else if (x > neckEndX) {
      // Strumming area - play open string
      playedNote = stringConfig.openNote;
    } else {
      return;
    }
    
    // Play the sound
    audioEngine.playNote(playedNote);
    
    // Add ripple effect
    const rippleId = ++rippleIdRef.current;
    const stringY = stringStartY + closestString * stringSpacing;
    setRipples(prev => [...prev, { id: rippleId, x, y: stringY }]);
    setActiveString(closestString);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== rippleId));
      setActiveString(null);
    }, 300);
    
    // Notify parent
    onNotePlayed(playedNote);
  }, [activeStrings, stringCount, onNotePlayed]);
  
  // Render position markers for hints
  const renderPositionMarkers = () => {
    if (!hintsEnabled) return null;
    
    const markers: JSX.Element[] = [];
    const markerPositions = [2, 4, 5, 7, 9, 11, 12]; // Common oud positions
    
    markerPositions.forEach((semitone, i) => {
      const x = neckStartX + (semitone / MAX_SEMITONES) * fingerboardWidth;
      markers.push(
        <line
          key={`marker-${i}`}
          x1={x}
          y1={stringStartY - 15}
          x2={x}
          y2={stringEndY + 15}
          stroke="hsl(var(--oud-rosette))"
          strokeWidth={semitone === 12 ? 3 : 1}
          strokeDasharray={semitone === 12 ? undefined : "4,4"}
          opacity={0.5}
        />
      );
      
      // Add semitone number
      markers.push(
        <text
          key={`marker-text-${i}`}
          x={x}
          y={stringStartY - 22}
          textAnchor="middle"
          className="fill-muted-foreground text-xs"
          fontSize={10}
        >
          {semitone}
        </text>
      );
    });
    
    return markers;
  };
  
  return (
    <div className="relative">
      {/* Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={hintsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setHintsEnabled(!hintsEnabled)}
                className="gap-2"
              >
                {hintsEnabled ? <Lightbulb className="w-4 h-4" /> : <LightbulbOff className="w-4 h-4" />}
                Hints
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show string names and position markers</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="text-sm text-muted-foreground flex gap-4">
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <span className="underline decoration-dotted">← Fingerboard</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Tap here to play different notes based on position</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <span className="underline decoration-dotted">Bowl (open string) →</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Tap here to play the open string note</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Oud SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto cursor-pointer oud-shadow"
        onClick={handleOudClick}
        style={{ minHeight: '200px' }}
      >
        <defs>
          {/* Wood grain gradient for body */}
          <linearGradient id="woodGrain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(30, 50%, 35%)" />
            <stop offset="30%" stopColor="hsl(25, 55%, 30%)" />
            <stop offset="60%" stopColor="hsl(28, 52%, 32%)" />
            <stop offset="100%" stopColor="hsl(25, 50%, 28%)" />
          </linearGradient>
          
          {/* Neck gradient */}
          <linearGradient id="neckGrain" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(25, 45%, 22%)" />
            <stop offset="50%" stopColor="hsl(25, 40%, 18%)" />
            <stop offset="100%" stopColor="hsl(25, 45%, 22%)" />
          </linearGradient>
          
          {/* Rosette pattern */}
          <radialGradient id="rosetteGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(25, 30%, 12%)" />
            <stop offset="70%" stopColor="hsl(42, 70%, 50%)" />
            <stop offset="85%" stopColor="hsl(25, 30%, 15%)" />
            <stop offset="100%" stopColor="hsl(42, 60%, 45%)" />
          </radialGradient>
        </defs>
        
        {/* Bowl/body (right side, ellipse) */}
        <ellipse
          cx={bowlCenterX}
          cy={svgHeight / 2}
          rx={bowlWidth / 2}
          ry={100}
          fill="url(#woodGrain)"
          className="transition-all duration-200"
        />
        
        {/* Sound hole / rosette */}
        <circle
          cx={bowlCenterX - 30}
          cy={svgHeight / 2}
          r={35}
          fill="url(#rosetteGrad)"
        />
        <circle
          cx={bowlCenterX - 30}
          cy={svgHeight / 2}
          r={25}
          fill="hsl(25, 30%, 8%)"
        />
        
        {/* Decorative rosette rings */}
        {[28, 32, 38].map((r, i) => (
          <circle
            key={i}
            cx={bowlCenterX - 30}
            cy={svgHeight / 2}
            r={r}
            fill="none"
            stroke="hsl(42, 70%, 55%)"
            strokeWidth={1}
            opacity={0.6}
          />
        ))}
        
        {/* Neck */}
        <rect
          x={neckStartX - 10}
          y={stringStartY - 20}
          width={neckEndX - neckStartX + 40}
          height={stringEndY - stringStartY + 40}
          rx={5}
          fill="url(#neckGrain)"
        />
        
        {/* Nut (where strings end on left) */}
        <rect
          x={neckStartX - 5}
          y={stringStartY - 10}
          width={8}
          height={stringEndY - stringStartY + 20}
          fill="hsl(40, 20%, 85%)"
          rx={2}
        />
        
        {/* Position markers */}
        {renderPositionMarkers()}
        
        {/* Strings */}
        {activeStrings.map((stringConfig, i) => {
          const y = stringStartY + i * stringSpacing;
          const isActive = activeString === i;
          
          // Render double courses if configured
          const courseCount = stringConfig.courseCount;
          const courseOffset = courseCount > 1 ? 3 : 0;
          
          return (
            <g key={i}>
              {Array.from({ length: courseCount }).map((_, courseIdx) => {
                const courseY = y + (courseIdx - (courseCount - 1) / 2) * courseOffset;
                return (
                  <line
                    key={courseIdx}
                    x1={neckStartX}
                    y1={courseY}
                    x2={bowlCenterX + 80}
                    y2={courseY}
                    stroke={isActive ? "hsl(42, 80%, 70%)" : "hsl(var(--oud-string))"}
                    strokeWidth={isActive ? 2.5 : 1.5 + (i * 0.2)}
                    className={cn("string-hover transition-all duration-150", isActive && "note-glow")}
                  />
                );
              })}
              
              {/* String label (when hints enabled) */}
              {hintsEnabled && (
                <text
                  x={neckStartX - 25}
                  y={y + 5}
                  textAnchor="middle"
                  className="fill-accent font-semibold"
                  fontSize={12}
                >
                  {formatNoteShort(stringConfig.openNote, notationSystem)}
                  <tspan fontSize={9}>{stringConfig.openNote.octave}</tspan>
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
            r={20}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth={3}
            className="animate-tap-ripple"
            opacity={0.8}
          />
        ))}
        
        {/* Bridge */}
        <rect
          x={bowlCenterX + 60}
          y={stringStartY - 5}
          width={30}
          height={stringEndY - stringStartY + 10}
          fill="hsl(25, 40%, 20%)"
          rx={3}
        />
      </svg>
    </div>
  );
}
