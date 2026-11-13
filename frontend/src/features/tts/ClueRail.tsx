import React from 'react';
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
  const acrossEntries = entries
    .filter((e) => e.direction === 'across')
    .sort((a, b) => a.number - b.number);

  const downEntries = entries
    .filter((e) => e.direction === 'down')
    .sort((a, b) => a.number - b.number);

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
                        fontSize: '16px',
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
                      style={{ fontSize: '13px', color: 'var(--text-sec)' }}
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

  return (
    <div
      className="h-full flex flex-col gap-4"
      style={{
        background: 'var(--card)',
        borderRadius: '28px',
        padding: '22px',
        boxShadow: '0 6px 0 var(--edge)',
      }}
    >
      {renderSection('➡️ Mendatar', 'var(--blue)', acrossEntries)}
      {renderSection('⬇️ Menurun', 'var(--coral)', downEntries)}
    </div>
  );
};
