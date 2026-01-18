import { cn } from '@/lib/utils';

interface MicLevelIndicatorProps {
  level: number; // 0-1 normalized
  status: 'listening' | 'recovering' | 'error' | 'off';
  className?: string;
}

export function MicLevelIndicator({ level, status, className }: MicLevelIndicatorProps) {
  // Normalize level (RMS is typically 0-0.5 for normal audio)
  const normalizedLevel = Math.min(level * 5, 1);
  
  const getStatusColor = () => {
    switch (status) {
      case 'listening':
        return 'bg-success';
      case 'recovering':
        return 'bg-warning';
      case 'error':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return 'Listening';
      case 'recovering':
        return 'Recovering...';
      case 'error':
        return 'Error';
      default:
        return 'Off';
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status dot */}
      <div 
        className={cn(
          'w-2 h-2 rounded-full transition-colors',
          getStatusColor(),
          status === 'recovering' && 'animate-pulse'
        )}
      />
      
      {/* Level bar */}
      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full transition-all duration-75 rounded-full',
            status === 'listening' ? 'bg-success' : 
            status === 'recovering' ? 'bg-warning' : 
            'bg-muted-foreground'
          )}
          style={{ width: `${normalizedLevel * 100}%` }}
        />
      </div>
      
      {/* Status text - only show on larger screens */}
      <span className="hidden sm:inline text-xs text-muted-foreground">
        {getStatusText()}
      </span>
    </div>
  );
}
