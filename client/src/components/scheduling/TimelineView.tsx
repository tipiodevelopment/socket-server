/**
 * Vista de timeline para ver programación completa de un broadcast
 * Muestra polls, contests y componentes en una línea de tiempo visual
 * TODO: Integrar en broadcast-detail.tsx cuando se implemente scheduling completo
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface TimelineItem {
  id: string;
  type: 'poll' | 'contest' | 'component';
  name: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  isActive?: boolean;
}

interface TimelineViewProps {
  broadcastStartTime: Date;
  broadcastEndTime?: Date;
  items: TimelineItem[];
}

export function TimelineView({ broadcastStartTime, broadcastEndTime, items }: TimelineViewProps) {
  const sortedItems = [...items].sort(
    (a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime()
  );

  const formatRelative = (date: Date): string => {
    const diff = (date.getTime() - broadcastStartTime.getTime()) / 1000;
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = Math.floor(abs % 60);
    const prefix = diff < 0 ? '-' : '+';
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return `${prefix}${parts.join('')}`;
  };

  const typeColor = (type: TimelineItem['type']) => {
    switch (type) {
      case 'poll': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'contest': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'component': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
  };

  return (
    <Card data-testid="timeline-view">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4" />
          Timeline del Broadcast
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Inicio: {broadcastStartTime.toLocaleString()}
          {broadcastEndTime && ` | Fin: ${broadcastEndTime.toLocaleString()}`}
        </p>
      </CardHeader>
      <CardContent>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay elementos programados
          </p>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-2 rounded-md border"
                data-testid={`timeline-item-${item.type}-${item.id}`}
              >
                <div className="w-1 h-8 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={typeColor(item.type)}>
                      {item.type}
                    </Badge>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {item.isActive && (
                      <Badge variant="default" className="text-xs">activo</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelative(item.scheduledStart)} → {formatRelative(item.scheduledEnd)}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  <p>{item.scheduledStart.toLocaleTimeString()}</p>
                  <p>{item.scheduledEnd.toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
