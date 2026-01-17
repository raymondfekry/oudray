import React from 'react';
import { Note, formatNoteShort, NotationSystem, getStaffPosition } from '@/lib/noteUtils';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface TargetNote {
  note: Note;
  status: 'pending' | 'correct' | 'incorrect';
  isNew?: boolean;
  uid?: string;
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
  const leftPadding = 70;
  const middleLineY = staffHeight / 2;
  const isMobile = useIsMobile();
  const currentNote = targetNotes[currentIndex]?.note;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);
  
  React.useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    
    const baseHeight = 180;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      const height = entry.contentRect.height;
      if (!height) return;
      const nextScale = Math.min(1, height / baseHeight);
      setScale(nextScale);
    });
    
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  
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
        key={targetNote.uid ?? `${note.letter}${note.accidental ?? ''}${note.octave}-${index}`}
        className={cn(
          status === 'correct' && 'animate-note-correct',
          status === 'incorrect' && 'animate-note-shake'
        )}
        style={{
          transform: `translateX(${noteX}px)`,
          transition: status === 'pending' ? 'transform 0.4s ease-out' : 'none'
        }}
      >
        {/* Ledger lines */}
        {ledgerLines.map((ly, i) => (
          <line
            key={i}
            x1={-10}
            y1={ly}
            x2={10}
            y2={ly}
            className="stroke-staff-line"
            strokeWidth={1}
          />
        ))}
        
        {/* Accidental symbol */}
        {note.accidental && (
          <text
            x={-12}
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
          cx={0}
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
          transform={`rotate(-15 0 ${noteY})`}
        />
        
        {/* Note stem */}
        <line
          x1={(position < 0 ? -5 : 5)}
          y1={noteY}
          x2={(position < 0 ? -5 : 5)}
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
            cx={0}
            cy={noteY - 18}
            r={3}
            className="fill-accent animate-pulse"
          />
        )}
      </g>
    );
  };
  
  return (
    <div
      ref={containerRef}
      className="bg-parchment rounded-lg p-2 shadow border border-border overflow-hidden h-full flex flex-col"
    >
      <div
        className="flex flex-1 items-center gap-2"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <div className="flex-1 h-full flex flex-col justify-center">
          <svg 
            viewBox={`0 0 ${leftPadding + targetNotes.length * noteSpacing + 20} ${staffHeight}`}
            className="w-full h-full"
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
        </div>
        <div
          className={cn(
            'flex items-center justify-center',
            !isMobile && 'hidden'
          )}
        >
          {currentNote && (
            <div className="px-2 py-0.5 rounded text-xs font-medium bg-accent text-accent-foreground">
              {formatNoteShort(currentNote, notationSystem)}{currentNote.octave}
            </div>
          )}
        </div>
      </div>
      
      <div
        className={cn(
          'justify-center gap-4 ml-8 mt-1',
          isMobile ? 'hidden' : 'flex'
        )}
      >
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
