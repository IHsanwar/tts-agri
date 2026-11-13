import React, { useState } from 'react';
import { CrosswordEntry, CrosswordAction } from './ttsReducer';
import { cn } from '../../lib/utils';

interface ClueRailProps {
  entries: CrosswordEntry[];
  activeEntryId: string | null;
  dispatch: React.Dispatch<CrosswordAction>;
  onOpenHintDialog?: (entry: CrosswordEntry) => void;
  disabled?: boolean;
}

export const ClueRail: React.FC<ClueRailProps> = ({
  entries,
  activeEntryId,
  dispatch,
  onOpenHintDialog,
  disabled = false,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const acrossEntries = entries
    .filter((e) => e.direction === 'across')
    .sort((a, b) => a.number - b.number);

  const downEntries = entries
    .filter((e) => e.direction === 'down')
    .sort((a, b) => a.number - b.number);

  const allEntries = [...acrossEntries, ...downEntries].sort(
    (a, b) => a.number - b.number
  );

  /* ────────────────────────── LIST VIEW ────────────────────────── */

  const renderSection = (
    label: string,
    accent: string,
    list: CrosswordEntry[]
  ) => (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <span
          className="font-display"
          style={{
            background: accent,
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 600,
            padding: '6px 16px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {label}
        </span>
        <span
          className="font-display"
          style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-sec)' }}
        >
          {list.filter((e) => e.status !== 'unsolved').length}/{list.length}
        </span>
      </div>

      <div className="overflow-y-auto space-y-1 pr-1 flex-1">
        {list.map((entry) => {
          const isActive = entry.id === activeEntryId;
          const isSolved = entry.status === 'solved';
          const isAssisted = entry.status === 'assisted';
          const isAnswered = isSolved || isAssisted;

          let itemBg = 'transparent';
          let itemBorderLeft = '6px solid transparent';
          let itemTransform = 'none';
          let itemColor = 'var(--text)';

          if (isActive) {
            itemBg = '#FFF1B8';
            itemBorderLeft = '6px solid var(--orange)';
            itemTransform = 'translateX(6px)';
            itemColor = 'var(--brown)';
          }

          return (
            <div
              key={entry.id}
              onClick={() => {
                if (!disabled) {
                  dispatch({ type: 'SELECT_ENTRY', entryId: entry.id });
                }
              }}
              className={cn(
                'group cursor-pointer text-left'
              )}
              style={{
                padding: '10px 12px',
                borderRadius: '16px',
                borderLeft: itemBorderLeft,
                background: itemBg,
                transform: itemTransform,
                transition: 'background 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--hover-soft)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-start gap-2">
                  <span
                    className="font-display flex items-center justify-center flex-shrink-0"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '9999px',
                      background: isAnswered ? 'var(--mint)' : accent,
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {entry.number}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="leading-snug"
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: itemColor,
                        textDecoration: isAnswered ? 'line-through' : 'none',
                        textDecorationColor: isAnswered ? 'var(--mint)' : undefined,
                        textDecorationThickness: isAnswered ? '2px' : undefined,
                      }}
                    >
                      {entry.clue_en}
                    </div>
                    <div
                      className="italic mt-0.5"
                      style={{ fontSize: '16px', color: 'var(--text-sec)', lineHeight: 1.4 }}
                    >
                      {entry.clue_id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  {isAssisted && (
                    <span
                      className="font-display"
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: 'var(--blue-soft)',
                        color: 'var(--blue)',
                        borderRadius: '999px',
                        fontWeight: 600,
                      }}
                    >
                      Bantuan
                    </span>
                  )}
                  {isAnswered && (
                    <span aria-hidden="true" style={{ fontSize: '14px' }}>
                      ✅
                    </span>
                  )}
                  {!isAnswered && onOpenHintDialog && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenHintDialog(entry);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        padding: '4px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-sec)',
                        fontSize: '14px',
                      }}
                      title="Minta bantuan (Hint)"
                      aria-label={`Minta bantuan untuk soal ${entry.number}`}
                    >
                      💡
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const listView = (
    <>
      {renderSection('➡️ Mendatar', 'var(--blue)', acrossEntries)}
      {renderSection('⬇️ Menurun', 'var(--coral)', downEntries)}
    </>
  );

  /* ────────────────────────── CARD ARROW VIEW ────────────────────────── */

  const cardView = (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-display"
          style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-sec)' }}
        >
          Semua Soal
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1" style={{ color: 'var(--blue)', fontWeight: 600 }}>
            → Mendatar ({acrossEntries.length})
          </span>
          <span className="flex items-center gap-1" style={{ color: 'var(--coral)', fontWeight: 600 }}>
            ↓ Menurun ({downEntries.length})
          </span>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 pr-1">
        <div className="grid grid-cols-1 gap-2">
          {allEntries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            const isSolved = entry.status === 'solved';
            const isAssisted = entry.status === 'assisted';
            const isAnswered = isSolved || isAssisted;
            const isAcross = entry.direction === 'across';
            const accent = isAcross ? 'var(--blue)' : 'var(--coral)';
            const accentSoft = isAcross ? 'var(--blue-soft)' : 'var(--coral-soft)';
            const arrow = isAcross ? '→' : '↓';

            let cardBg = 'var(--card)';
            let cardBorder = `3px solid ${accentSoft}`;
            let cardShadow = '0 3px 0 var(--edge)';

            if (isActive) {
              cardBg = accentSoft;
              cardBorder = `3px solid ${accent}`;
              cardShadow = `0 4px 0 ${accent}`;
            } else if (isAnswered) {
              cardBg = 'var(--mint-soft)';
              cardBorder = '3px solid var(--mint)';
            }

            return (
              <div
                key={entry.id}
                onClick={() => {
                  if (!disabled) {
                    dispatch({ type: 'SELECT_ENTRY', entryId: entry.id });
                  }
                }}
                className={cn(
                  'group cursor-pointer text-left'
                )}
                style={{
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: cardBg,
                  border: cardBorder,
                  boxShadow: cardShadow,
                  transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isAnswered) {
                    e.currentTarget.style.background = 'var(--hover-soft)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isAnswered) {
                    e.currentTarget.style.background = 'var(--card)';
                  }
                }}
              >
                <div className="flex items-start gap-2.5">
                  {/* Arrow + number badge */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span
                      className="font-display flex items-center justify-center"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: isAnswered ? 'var(--mint)' : accent,
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {arrow}
                    </span>
                    <span
                      className="font-display"
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--text-sec)',
                        lineHeight: 1,
                      }}
                    >
                      #{entry.number}
                    </span>
                  </div>

                  {/* Clue text */}
                  <div style={{ minWidth: 0 }} className="flex-1">
                    <div
                      className="leading-snug"
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--text)',
                        textDecoration: isAnswered ? 'line-through' : 'none',
                        textDecorationColor: isAnswered ? 'var(--mint)' : undefined,
                        textDecorationThickness: isAnswered ? '2px' : undefined,
                      }}
                    >
                      {entry.clue_en}
                    </div>
                    <div
                      className="italic mt-0.5"
                      style={{ fontSize: '14px', color: 'var(--text-sec)', lineHeight: 1.35 }}
                    >
                      {entry.clue_id}
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {isAssisted && (
                      <span
                        className="font-display"
                        style={{
                          fontSize: '9px',
                          padding: '2px 5px',
                          background: 'var(--blue-soft)',
                          color: 'var(--blue)',
                          borderRadius: '999px',
                          fontWeight: 600,
                        }}
                      >
                        Bantuan
                      </span>
                    )}
                    {isAnswered && (
                      <span aria-hidden="true" style={{ fontSize: '14px' }}>
                        ✅
                      </span>
                    )}
                    {!isAnswered && onOpenHintDialog && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenHintDialog(entry);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          padding: '2px',
                          borderRadius: '6px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-sec)',
                          fontSize: '14px',
                        }}
                        title="Minta bantuan (Hint)"
                        aria-label={`Minta bantuan untuk soal ${entry.number}`}
                      >
                        💡
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ────────────────────────── VIEW TOGGLE ────────────────────────── */

  const ToggleButton = ({ mode, icon, label }: { mode: 'list' | 'card'; icon: string; label: string }) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      className="font-display transition-all"
      style={{
        padding: '5px 12px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        background: viewMode === mode ? 'var(--blue)' : 'var(--hover-soft)',
        color: viewMode === mode ? '#ffffff' : 'var(--text-sec)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      className="h-full min-h-0 flex flex-col gap-3"
      style={{
        background: 'var(--card)',
        borderRadius: '28px',
        padding: 'clamp(14px, 2.5vw, 24px)',
        boxShadow: '0 6px 0 var(--edge)',
      }}
    >
      {/* View mode toggle */}
      <div className="flex items-center justify-between">
        <span
          className="font-display"
          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-sec)' }}
        >
          Tampilan Soal
        </span>
        <div className="flex items-center gap-1.5">
          <ToggleButton mode="list" icon="☰" label="List" />
          <ToggleButton mode="card" icon="🎴" label="Card" />
        </div>
      </div>

      {viewMode === 'list' ? listView : cardView}
    </div>
  );
};
