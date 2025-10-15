import { useEffect, useRef } from 'react';
import type { WebSocketEvent } from '@shared/schema';

interface EventLogProps {
  events: WebSocketEvent[];
  onClear: () => void;
}

export function EventLog({ events, onClear }: EventLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [events]);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'product':
        return 'text-primary';
      case 'poll':
        return 'text-secondary';
      case 'contest':
        return 'text-amber-500';
      default:
        return 'text-foreground';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'product':
        return 'PRODUCT';
      case 'poll':
        return 'POLL';
      case 'contest':
        return 'CONTEST';
      default:
        return type.toUpperCase();
    }
  };

  const getEventName = (event: WebSocketEvent) => {
    switch (event.type) {
      case 'product':
        return event.data.name;
      case 'poll':
        return event.data.question;
      case 'contest':
        return event.data.name;
      default:
        return 'Unknown event';
    }
  };

  const getEventAction = (type: string) => {
    switch (type) {
      case 'product':
        return 'Sent';
      case 'poll':
        return 'Started';
      case 'contest':
        return 'Launched';
      default:
        return 'Sent';
    }
  };

  return (
    <div className="bg-card border-0 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Event Log</h3>
        <button 
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={onClear}
          data-testid="button-clear-log"
        >
          Clear
        </button>
      </div>
      
      <div 
        ref={logRef}
        className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin" 
        data-testid="event-log"
      >
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No events registered
          </div>
        ) : (
          events.map((event) => (
            <div 
              key={`${event.type}-${event.timestamp}`} 
              className="bg-background border-0 rounded p-3 text-sm log-entry"
              data-testid={`log-entry-${event.type}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-medium ${getEventTypeColor(event.type)}`}>
                  {getEventTypeLabel(event.type)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString('en-US')}
                </span>
              </div>
              <div className="text-muted-foreground text-xs font-mono">
                {getEventAction(event.type)}: {getEventName(event)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
