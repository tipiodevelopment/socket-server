/**
 * Input especializado para tiempos relativos al video
 * Acepta formato HH:MM:SS o segundos directos
 * TODO: Integrar en SchedulingForm cuando se necesite
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface VideoTimeInputProps {
  label: string;
  value: number;
  onChange: (seconds: number) => void;
  allowNegative?: boolean;
  testId?: string;
}

export function VideoTimeInput({
  label,
  value,
  onChange,
  allowNegative = true,
  testId,
}: VideoTimeInputProps) {
  const [mode, setMode] = useState<'seconds' | 'time'>('seconds');
  const [timeValue, setTimeValue] = useState('');

  useEffect(() => {
    if (mode === 'time') {
      const abs = Math.abs(value);
      const h = Math.floor(abs / 3600);
      const m = Math.floor((abs % 3600) / 60);
      const s = abs % 60;
      const sign = value < 0 ? '-' : '';
      setTimeValue(`${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }
  }, [value, mode]);

  const parseTimeToSeconds = (time: string): number | null => {
    const negative = time.startsWith('-');
    const clean = time.replace(/^-/, '');
    const parts = clean.split(':');

    if (parts.length !== 3) return null;

    const [h, m, s] = parts.map(Number);
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;

    const total = h * 3600 + m * 60 + s;
    return negative ? -total : total;
  };

  const handleTimeChange = (val: string) => {
    setTimeValue(val);
    const seconds = parseTimeToSeconds(val);
    if (seconds !== null) {
      onChange(seconds);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          className="text-xs text-blue-500 hover:underline"
          onClick={() => setMode(mode === 'seconds' ? 'time' : 'seconds')}
          data-testid={`${testId}-toggle-mode`}
        >
          {mode === 'seconds' ? 'Usar HH:MM:SS' : 'Usar segundos'}
        </button>
      </div>

      {mode === 'seconds' ? (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          min={allowNegative ? undefined : 0}
          data-testid={testId}
        />
      ) : (
        <Input
          type="text"
          value={timeValue}
          onChange={(e) => handleTimeChange(e.target.value)}
          placeholder={allowNegative ? '-00:11:30' : '00:05:00'}
          data-testid={testId}
        />
      )}
    </div>
  );
}
