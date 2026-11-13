import React from 'react';
import { formatScore, formatTimeRemaining } from '../../lib/scoreFormat';
import { cn } from '../../lib/utils';

interface ScoreboardHeaderProps {
  competitionName: string;
  groupName: string;
  groupCode: string;
  score: number;
  deadlineIso: string | null;
  serverDeltaMs: number;
  outboxPendingCount: number;
  onOpenHintModal?: () => void;
  onCheckActiveWord?: () => void;
  onFinish?: () => void;
  canRequestHint?: boolean;
}

export const ScoreboardHeader: React.FC<ScoreboardHeaderProps> = ({
  competitionName,
  groupName,
  groupCode,
  score,
  deadlineIso,
  serverDeltaMs,
  outboxPendingCount,
  onOpenHintModal,
  onCheckActiveWord,
  onFinish,
  canRequestHint = false,
}) => {
  const [timer, setTimer] = React.useState(() =>
    formatTimeRemaining(deadlineIso, serverDeltaMs)
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimer(formatTimeRemaining(deadlineIso, serverDeltaMs));
    }, 500);
    return () => clearInterval(interval);
  }, [deadlineIso, serverDeltaMs]);

  return (
    <header className="px-4 py-3" style={{ background: 'transparent' }}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 md:gap-4">
        {/* Left: Kelas & Belajar + Group name */}
        <div className="min-w-0">
          <div
            className="font-display font-bold leading-tight"
            style={{ color: 'var(--text-sec)', fontSize: '13px' }}
          >
            {competitionName || 'Kelas & Belajar'}
          </div>
          <div className="font-display font-bold flex items-center gap-2" style={{ color: 'var(--text)', fontSize: '28px', lineHeight: 1.1 }}>
            <span className="truncate">{groupName}</span>
            {groupCode && (
              <span
                className="font-mono rounded-md"
                style={{
                  fontSize: '12px',
                  padding: '2px 6px',
                  background: 'var(--blue-soft)',
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                #{groupCode}
              </span>
            )}
          </div>
        </div>

        {/* Center: Timer & Score */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Timer pill */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full font-display tabular-nums',
              'transition-colors'
            )}
            style={{
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '18px',
              fontWeight: 600,
              boxShadow: '0 4px 0 var(--edge)',
              ...(timer.isUrgent
                ? { background: 'var(--coral-soft)', color: 'var(--coral)', boxShadow: '0 4px 0 var(--shadow-coral)' }
                : {}),
              ...(timer.isExpired
                ? { background: 'var(--coral)', color: '#ffffff', boxShadow: '0 4px 0 var(--shadow-coral)' }
                : {}),
            }}
            aria-live="polite"
          >
            <span aria-hidden="true">⏱️</span>
            <span>{timer.text}</span>
          </div>

          {/* Score badge pill */}
          <div
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full"
            style={{
              background: 'var(--yellow)',
              boxShadow: '0 4px 0 var(--orange)',
            }}
          >
            <span aria-hidden="true">⭐</span>
            <div className="flex items-baseline gap-1">
              <span
                className="font-display font-bold uppercase"
                style={{ color: 'var(--brown)', fontSize: '11px' }}
              >
                Poin:
              </span>
              <span
                className="font-display tabular-nums"
                style={{ color: 'var(--brown)', fontSize: '22px', fontWeight: 700 }}
              >
                {formatScore(score)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Sync status */}
        <div className="flex items-center gap-2 md:gap-3">
          {onOpenHintModal && (
            <button
              type="button"
              onClick={onOpenHintModal}
              disabled={!canRequestHint}
              className="btn-playful"
              style={
                {
                  background: 'var(--yellow)',
                  color: 'var(--brown)',
                  '--btn-shadow': 'var(--orange)',
                  fontSize: '15px',
                } as React.CSSProperties
              }
            >
              <span aria-hidden="true">💡</span>
              <span>Bantuan</span>
            </button>
          )}

          {onCheckActiveWord && (
            <button
              type="button"
              onClick={onCheckActiveWord}
              className="btn-playful"
              style={
                {
                  background: 'var(--blue)',
                  color: '#ffffff',
                  '--btn-shadow': 'var(--shadow-blue)',
                  fontSize: '15px',
                } as React.CSSProperties
              }
            >
              <span>Cek Jawaban</span>
              <span aria-hidden="true">✨</span>
            </button>
          )}

          {onFinish && (
            <button
              type="button"
              onClick={onFinish}
              className="btn-playful"
              style={
                {
                  background: 'var(--mint)',
                  color: 'var(--green-deep)',
                  '--btn-shadow': 'var(--shadow-mint)',
                  fontSize: '15px',
                } as React.CSSProperties
              }
              title="Selesaikan sesi permainan dan lihat hasil akhir"
            >
              <span aria-hidden="true">✓</span>
              <span>Selesai</span>
            </button>
          )}

          {/* Connection / Outbox status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{
              background: 'var(--card)',
              boxShadow: '0 2px 0 var(--edge)',
            }}
            title={outboxPendingCount > 0 ? `${outboxPendingCount} event tertunda` : 'Tersinkronisasi'}
          >
            <span
              aria-hidden="true"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '9999px',
                background: outboxPendingCount > 0 ? 'var(--coral)' : 'var(--mint)',
                boxShadow: outboxPendingCount > 0 ? '0 0 0 2px var(--coral-soft)' : '0 0 0 2px var(--mint-soft)',
              }}
            />
            <span
              className="font-display"
              style={{
                color: outboxPendingCount > 0 ? 'var(--orange)' : 'var(--mint)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {outboxPendingCount > 0 ? `Sync (${outboxPendingCount})` : 'Online'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
