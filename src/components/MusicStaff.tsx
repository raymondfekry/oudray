import React from 'react';
import { Note, formatNoteShort, NotationSystem, getStaffPosition } from '@/lib/noteUtils';
import { cn } from '@/lib/utils';

interface TargetNote {
  note: Note;
  status: 'pending' | 'correct' | 'incorrect';
  isNew?: boolean;
}

interface MusicStaffProps {
  targetNotes: TargetNote[];
  currentIndex: number;
  notationSystem: NotationSystem;
}

export function MusicStaff({ targetNotes, currentIndex, notationSystem }: MusicStaffProps) {
  const staffHeight = 200;
  const lineSpacing = 20;
  const noteSpacing = 100;
  const leftPadding = 100;
  const middleLineY = staffHeight / 2;
  
  // Staff lines Y positions (5 lines)
  const staffLines = [-2, -1, 0, 1, 2].map(i => middleLineY + i * lineSpacing);
  
  const renderNote = (targetNote: TargetNote, index: number) => {
    const { note, status, isNew } = targetNote;
    const isCurrent = index === currentIndex;
    
    // Calculate Y position based on note
    // Treble clef: B4 is on middle line, each step is half a lineSpacing
    const position = getStaffPosition(note);
    const noteY = middleLineY - position * (lineSpacing / 2);
    const noteX = leftPadding + index * noteSpacing;
    
    // Check if we need ledger lines
    const ledgerLines: number[] = [];
    
    // Ledger lines below (C4 and below)
    if (position <= -6) {
      for (let p = -6; p >= position; p -= 2) {
        ledgerLines.push(middleLineY - p * (lineSpacing / 2));
      }
    }
    
    // Ledger lines above (A5 and above)
    if (position >= 6) {
      for (let p = 6; p <= position; p += 2) {
        ledgerLines.push(middleLineY - p * (lineSpacing / 2));
      }
    }
    
    return (
      <g 
        key={`${note.letter}${note.octave}-${index}`}
        className={cn(
          'transition-all duration-300',
          isNew && 'animate-note-slide',
          status === 'correct' && 'animate-note-correct',
          status === 'incorrect' && 'animate-note-shake'
        )}
      >
        {/* Ledger lines */}
        {ledgerLines.map((ly, i) => (
          <line
            key={i}
            x1={noteX - 18}
            y1={ly}
            x2={noteX + 18}
            y2={ly}
            className="stroke-staff-line"
            strokeWidth={1.5}
          />
        ))}
        
        {/* Note head (ellipse) */}
        <ellipse
          cx={noteX}
          cy={noteY}
          rx={10}
          ry={8}
          className={cn(
            'transition-all duration-200',
            isCurrent && status === 'pending' && 'fill-accent note-glow',
            status === 'correct' && 'fill-success',
            status === 'incorrect' && 'fill-destructive',
            !isCurrent && status === 'pending' && 'fill-staff-note'
          )}
          transform={`rotate(-15 ${noteX} ${noteY})`}
        />
        
        {/* Note stem */}
        <line
          x1={noteX + (position < 0 ? -9 : 9)}
          y1={noteY}
          x2={noteX + (position < 0 ? -9 : 9)}
          y2={noteY + (position < 0 ? 50 : -50)}
          className={cn(
            'transition-all duration-200',
            status === 'correct' && 'stroke-success',
            status === 'incorrect' && 'stroke-destructive',
            status === 'pending' && 'stroke-staff-note'
          )}
          strokeWidth={2}
        />
        
        {/* Current note indicator */}
        {isCurrent && status === 'pending' && (
          <circle
            cx={noteX}
            cy={noteY - 30}
            r={4}
            className="fill-accent animate-pulse"
          />
        )}
        
        {/* Status indicator */}
        {status === 'correct' && (
          <text
            x={noteX}
            y={noteY + 35}
            textAnchor="middle"
            className="fill-success text-lg"
          >
            ✓
          </text>
        )}
        {status === 'incorrect' && isCurrent && (
          <text
            x={noteX}
            y={noteY + 35}
            textAnchor="middle"
            className="fill-destructive text-lg"
          >
            ✗
          </text>
        )}
      </g>
    );
  };
  
  return (
    <div className="bg-parchment rounded-xl p-6 shadow-lg border border-border overflow-hidden">
      <svg 
        viewBox={`0 0 ${leftPadding + targetNotes.length * noteSpacing + 50} ${staffHeight}`}
        className="w-full h-auto"
        style={{ minHeight: '180px' }}
      >
        {/* Staff lines */}
        {staffLines.map((y, i) => (
          <line
            key={i}
            x1={20}
            y1={y}
            x2={leftPadding + targetNotes.length * noteSpacing + 30}
            y2={y}
            className="stroke-staff-line"
            strokeWidth={1.5}
          />
        ))}
        
        {/* Treble clef (simplified) */}
        <text
          x={35}
          y={middleLineY + 35}
          className="fill-staff-note musical-text"
          fontSize={80}
          fontFamily="serif"
        >
          𝄞
        </text>
        
        {/* Notes */}
        {targetNotes.map((targetNote, index) => renderNote(targetNote, index))}
      </svg>
      
      {/* Note labels below */}
      <div className="flex justify-center mt-4 gap-8 ml-16">
        {targetNotes.map((targetNote, index) => (
          <div
            key={index}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium transition-all',
              index === currentIndex && targetNote.status === 'pending' && 'bg-accent text-accent-foreground',
              targetNote.status === 'correct' && 'bg-success/20 text-success',
              targetNote.status === 'incorrect' && index === currentIndex && 'bg-destructive/20 text-destructive',
              targetNote.status === 'pending' && index !== currentIndex && 'text-muted-foreground'
            )}
            style={{ width: '80px', textAlign: 'center' }}
          >
            {formatNoteShort(targetNote.note, notationSystem)}{targetNote.note.octave}
          </div>
        ))}
      </div>
    </div>
  );
}
