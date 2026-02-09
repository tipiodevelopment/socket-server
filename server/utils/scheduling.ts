/**
 * Utilidades para calcular timestamps de programación relativa al video.
 *
 * Concepto: Los polls/contests/componentes se programan como offsets en segundos
 * relativos al inicio de un broadcast. El backend calcula los timestamps absolutos.
 *
 * Ejemplo:
 *   broadcastStartTime = "2025-01-23T20:00:00Z"
 *   videoStartTime = -690 (11:30 antes del inicio)
 *   videoEndTime = 0 (al momento del inicio)
 *   → scheduledStart = 2025-01-23T19:48:30Z
 *   → scheduledEnd = 2025-01-23T20:00:00Z
 */

export interface SchedulingInput {
  broadcastStartTime: string;
  videoStartTime: number;
  videoEndTime: number;
}

export interface SchedulingOutput {
  scheduledStart: Date;
  scheduledEnd: Date;
}

export function calculateScheduledTimes(
  input: SchedulingInput
): SchedulingOutput {
  const broadcastStart = new Date(input.broadcastStartTime);

  const scheduledStart = new Date(
    broadcastStart.getTime() + input.videoStartTime * 1000
  );
  const scheduledEnd = new Date(
    broadcastStart.getTime() + input.videoEndTime * 1000
  );

  return { scheduledStart, scheduledEnd };
}

export function validateScheduling(input: SchedulingInput): {
  valid: boolean;
  error?: string;
} {
  if (input.videoEndTime < input.videoStartTime) {
    return {
      valid: false,
      error: 'videoEndTime must be greater than or equal to videoStartTime',
    };
  }

  try {
    const broadcastStart = new Date(input.broadcastStartTime);
    if (isNaN(broadcastStart.getTime())) {
      return {
        valid: false,
        error: 'Invalid broadcastStartTime format',
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid broadcastStartTime format',
    };
  }

  return { valid: true };
}

export function formatRelativeTime(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;

  const prefix = seconds < 0 ? '-' : '+';
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return `${prefix}${parts.join(' ')}`;
}
