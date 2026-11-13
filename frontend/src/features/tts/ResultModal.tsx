import React from 'react';
import { Confetti } from './Confetti';
import { formatScore, formatDuration } from '../../lib/scoreFormat';

export interface ResultData {
  solvedCount: number;
  totalEntries: number;
  score: number;
  durationSeconds?: number | null;
  allCorrect: boolean;
  label: string;
}

export const ResultModal: React.FC<{
  data: ResultData;
  onPlayAgain: () => void;
}> = ({ data, onPlayAgain }) => {
  const { solvedCount, totalEntries, score, durationSeconds, allCorrect, label } = data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,30,60,0.45)', backdropFilter: 'blur(2px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Hasil akhir"
    >
      {allCorrect && <Confetti />}

      <div
        className="animate-modal-pop relative w-full max-w-md text-center"
        style={{
          background: 'var(--card)',
          borderRadius: '28px',
          padding: '32px 28px',
          boxShadow: '0 8px 0 var(--edge)',
        }}
      >
        <div aria-hidden="true" style={{ fontSize: '48px', marginBottom: '8px', lineHeight: 1 }}>
          {allCorrect ? '🏆' : '👏'}
        </div>
        <h2
          className="font-display"
          style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', lineHeight: 1.1 }}
        >
          {allCorrect ? 'Hebat sekali!' : 'Kerja bagus!'}
        </h2>
        <p style={{ color: 'var(--text-sec)', fontSize: '15px', marginBottom: '20px' }}>{label}</p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '24px',
          }}
        >
          <SummaryPill icon="✅" label="Kata benar" value={`${solvedCount}/${totalEntries}`} />
          <SummaryPill icon="⭐" label="Poin" value={formatScore(score)} />
          <SummaryPill
            icon="⏱️"
            label="Waktu"
            value={durationSeconds ? formatDuration(durationSeconds) : '-'}
          />
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          className="btn-playful w-full"
          style={
            {
              background: 'var(--blue)',
              color: '#ffffff',
              '--btn-shadow': 'var(--shadow-blue)',
              fontSize: '16px',
              padding: '12px 20px',
            } as React.CSSProperties
          }
        >
          Main lagi
        </button>
      </div>
    </div>
  );
};

const SummaryPill: React.FC<{ icon: string; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div
    style={{
      background: 'var(--hover-soft)',
      borderRadius: '14px',
      padding: '10px 14px',
      minWidth: '88px',
    }}
  >
    <div aria-hidden="true" style={{ fontSize: '18px' }}>
      {icon}
    </div>
    <div
      className="font-display"
      style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}
    >
      {value}
    </div>
    <div style={{ fontSize: '11px', color: 'var(--text-sec)' }}>{label}</div>
  </div>
);
