import React from 'react';
import { Note, formatNoteShort, NotationSystem, getStaffPosition } from '@/lib/noteUtils';
import { cn } from '@/lib/utils';

interface TargetNote {
  note: Note;
  status: 'pending' | 'correct' | 'incorrect';
  isNew?: boolean;
}

interface MusicStaffCompactProps {
  targetNotes: TargetNote[];
  currentIndex: number;
  notationSystem: NotationSystem;
}

export function MusicStaffCompact({ targetNotes, currentIndex, notationSystem }: MusicStaffCompactProps) {
  const staffHeight = 120;
  const lineSpacing = 12;
  const noteSpacing = 60;
  const leftPadding = 50;
  const middleLineY = staffHeight / 2;
  
  // Staff lines Y positions (5 lines)
  const staffLines = [-2, -1, 0, 1, 2].map(i => middleLineY + i * lineSpacing);
  
  const renderNote = (targetNote: TargetNote, index: number) => {
    const { note, status, isNew } = targetNote;
    const isCurrent = index === currentIndex;
    
    const position = getStaffPosition(note);
    const noteY = middleLineY - position * (lineSpacing / 2);
    const noteX = leftPadding + index * noteSpacing;
    
    // Check if we need ledger lines
    const ledgerLines: number[] = [];
    
    if (position <= -6) {
      for (let p = -6; p >= position; p -= 2) {
        ledgerLines.push(middleLineY - p * (lineSpacing / 2));
      }
    }
    
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
            x1={noteX - 10}
            y1={ly}
            x2={noteX + 10}
            y2={ly}
            className="stroke-staff-line"
            strokeWidth={1}
          />
        ))}
        
        {/* Accidental symbol */}
        {note.accidental && (
          <text
            x={noteX - 12}
            y={noteY + 4}
            className={cn(
              'font-bold transition-all duration-200',
              isCurrent && status === 'pending' && 'fill-accent',
              status === 'correct' && 'fill-success',
              status === 'incorrect' && 'fill-destructive',
              !isCurrent && status === 'pending' && 'fill-staff-note'
            )}
            fontSize={12}
            textAnchor="middle"
          >
            {note.accidental === '#' ? '♯' : '♭'}
          </text>
        )}
        
        {/* Note head */}
        <ellipse
          cx={noteX}
          cy={noteY}
          rx={6}
          ry={5}
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
          x1={noteX + (position < 0 ? -5 : 5)}
          y1={noteY}
          x2={noteX + (position < 0 ? -5 : 5)}
          y2={noteY + (position < 0 ? 30 : -30)}
          className={cn(
            'transition-all duration-200',
            status === 'correct' && 'stroke-success',
            status === 'incorrect' && 'stroke-destructive',
            status === 'pending' && 'stroke-staff-note'
          )}
          strokeWidth={1.5}
        />
        
        {/* Current note indicator */}
        {isCurrent && status === 'pending' && (
          <circle
            cx={noteX}
            cy={noteY - 18}
            r={3}
            className="fill-accent animate-pulse"
          />
        )}
      </g>
    );
  };
  
  return (
    <div className="bg-parchment rounded-lg p-2 shadow border border-border overflow-hidden h-full flex flex-col justify-center">
      <svg 
        viewBox={`0 0 ${leftPadding + targetNotes.length * noteSpacing + 20} ${staffHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Staff lines */}
        {staffLines.map((y, i) => (
          <line
            key={i}
            x1={10}
            y1={y}
            x2={leftPadding + targetNotes.length * noteSpacing + 10}
            y2={y}
            className="stroke-staff-line"
            strokeWidth={1}
          />
        ))}
        
        {/* Treble clef */}
        <text
          x={20}
          y={middleLineY + 22}
          className="fill-staff-note musical-text"
          fontSize={48}
          fontFamily="serif"
        >
          𝄞
        </text>
        
        {/* Notes */}
        {targetNotes.map((targetNote, index) => renderNote(targetNote, index))}
      </svg>
      
      {/* Compact note labels */}
      <div className="flex justify-center gap-4 ml-8 mt-1">
        {targetNotes.map((targetNote, index) => (
          <div
            key={index}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium transition-all',
              index === currentIndex && targetNote.status === 'pending' && 'bg-accent text-accent-foreground',
              targetNote.status === 'correct' && 'bg-success/20 text-success',
              targetNote.status === 'incorrect' && index === currentIndex && 'bg-destructive/20 text-destructive',
              targetNote.status === 'pending' && index !== currentIndex && 'text-muted-foreground'
            )}
          >
            {formatNoteShort(targetNote.note, notationSystem)}{targetNote.note.octave}
          </div>
        ))}
      </div>
    </div>
  );
}
