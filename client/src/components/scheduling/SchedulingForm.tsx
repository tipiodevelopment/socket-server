/**
 * Formulario para programar polls/contests con tiempos relativos al video
 * TODO: Integrar en broadcast-detail.tsx cuando el backend soporte scheduling completo
 *
 * Uso futuro:
 * <SchedulingForm
 *   broadcastStartTime={broadcast.startTime}
 *   onSubmit={(scheduling) => setFormData({ ...formData, scheduling })}
 * />
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar } from 'lucide-react';

interface SchedulingFormProps {
  broadcastStartTime: string;
  onSubmit: (scheduling: {
    videoStartTime: number;
    videoEndTime: number;
    broadcastStartTime: string;
  }) => void;
  onCancel?: () => void;
}

export function SchedulingForm({ broadcastStartTime, onSubmit, onCancel }: SchedulingFormProps) {
  const [videoStartTime, setVideoStartTime] = useState<number>(0);
  const [videoEndTime, setVideoEndTime] = useState<number>(300);

  const preview = useMemo(() => {
    const start = new Date(broadcastStartTime);
    if (isNaN(start.getTime())) return null;

    const scheduledStart = new Date(start.getTime() + videoStartTime * 1000);
    const scheduledEnd = new Date(start.getTime() + videoEndTime * 1000);

    return { scheduledStart, scheduledEnd };
  }, [broadcastStartTime, videoStartTime, videoEndTime]);

  const formatRelativeLabel = (seconds: number): string => {
    const abs = Math.abs(seconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const prefix = seconds < 0 ? 'antes' : 'despues';
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return `${parts.join(' ')} ${prefix} del inicio`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoEndTime < videoStartTime) return;
    onSubmit({ videoStartTime, videoEndTime, broadcastStartTime });
  };

  return (
    <Card data-testid="scheduling-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4" />
          Programacion Relativa al Video
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoStartTime">Inicio (segundos relativos al broadcast)</Label>
            <Input
              id="videoStartTime"
              type="number"
              value={videoStartTime}
              onChange={(e) => setVideoStartTime(parseInt(e.target.value) || 0)}
              placeholder="Ej: -690 (11:30 antes del inicio)"
              data-testid="input-video-start-time"
            />
            <p className="text-xs text-muted-foreground">
              {formatRelativeLabel(videoStartTime)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoEndTime">Fin (segundos relativos al broadcast)</Label>
            <Input
              id="videoEndTime"
              type="number"
              value={videoEndTime}
              onChange={(e) => setVideoEndTime(parseInt(e.target.value) || 0)}
              placeholder="Ej: 0 (al momento del inicio)"
              data-testid="input-video-end-time"
            />
            <p className="text-xs text-muted-foreground">
              {formatRelativeLabel(videoEndTime)}
            </p>
          </div>

          {videoEndTime < videoStartTime && (
            <p className="text-sm text-red-500">
              El tiempo de fin debe ser mayor o igual al tiempo de inicio
            </p>
          )}

          {preview && (
            <div className="rounded-md bg-muted p-3 space-y-1" data-testid="scheduling-preview">
              <p className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Preview
              </p>
              <p className="text-xs text-muted-foreground">
                Inicio: {preview.scheduledStart.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Fin: {preview.scheduledEnd.toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={videoEndTime < videoStartTime}
              data-testid="button-save-scheduling"
            >
              Guardar Programacion
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-scheduling">
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
