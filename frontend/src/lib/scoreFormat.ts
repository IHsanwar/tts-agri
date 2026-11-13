/**
 * Format helper for score, time, and currency/ranking displays.
 * NOTE: All scoring logic is authoritative on the server.
 */

export function formatScore(score: number): string {
  return Math.max(0, score).toLocaleString('id-ID');
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '-';
  const sec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTimeRemaining(deadlineIso: string | null, serverDeltaMs: number = 0): {
  text: string;
  secondsRemaining: number;
  isUrgent: boolean;
  isExpired: boolean;
} {
  if (!deadlineIso) {
    return { text: '--:--', secondsRemaining: 0, isUrgent: false, isExpired: false };
  }

  const deadlineMs = new Date(deadlineIso).getTime();
  const adjustedNowMs = Date.now() + serverDeltaMs;
  const diffSec = Math.max(0, Math.floor((deadlineMs - adjustedNowMs) / 1000));

  const text = formatDuration(diffSec);
  const isUrgent = diffSec <= 120 && diffSec > 0; // <= 2 mins
  const isExpired = diffSec <= 0;

  return {
    text,
    secondsRemaining: diffSec,
    isUrgent,
    isExpired,
  };
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

