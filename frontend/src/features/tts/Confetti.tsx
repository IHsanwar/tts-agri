import React, { useEffect, useState } from 'react';

const COLORS = ['#4d96ff', '#ffd93d', '#6bcb77', '#ff6b6b', '#ff9f1c'];

export const Confetti: React.FC<{ onDone?: () => void; count?: number }> = ({
  onDone,
  count = 40,
}) => {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.35,
      duration: 1.4 + Math.random() * 0.4,
    }))
  );

  useEffect(() => {
    const t = window.setTimeout(() => onDone?.(), 1800);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 60,
      }}
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};
