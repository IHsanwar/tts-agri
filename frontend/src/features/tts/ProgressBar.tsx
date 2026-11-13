import React from 'react';

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{
        height: '14px',
        background: 'var(--track-soft)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
      }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Kemajuan kata terjawab"
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--blue), var(--mint), var(--yellow))',
          borderRadius: '999px',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
};
