export const DURATION_PRESETS_MINUTES = [5, 10, 15, 30, 60] as const;

export function isValidDurationMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function formatDurationLabel(minutes: number): string {
  if (!isValidDurationMinutes(minutes)) return '';

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourLabel = `${hours} hr`;

  if (remainingMinutes === 0) return hourLabel;

  return `${hourLabel} ${remainingMinutes} min`;
}

export function parseCustomDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;

  const minutes = Number(trimmed);
  return isValidDurationMinutes(minutes) ? minutes : null;
}
