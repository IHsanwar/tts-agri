import React, { useRef, useEffect } from 'react';
import {
  CrosswordState,
  CrosswordAction,
  getEntryCells,
} from './ttsReducer';
import { ProgressBar } from './ProgressBar';
import { Toast, ToastType } from './Toast';
import { cn } from '../../lib/utils';

interface CrosswordGridProps {
  state: CrosswordState;
  dispatch: React.Dispatch<CrosswordAction>;
  onWordFilled?: (entryId: string, letters: string) => void;
  disabled?: boolean;
  toast?: { message: string; type: ToastType; key: number } | null;
}

export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  state,
  dispatch,
  onWordFilled,
  disabled = false,
  toast = null,
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Keep focus on hidden input for desktop keyboard capture
  useEffect(() => {
    if (
      !disabled &&
      hiddenInputRef.current &&
      window.matchMedia('(pointer: fine)').matches
    ) {
      hiddenInputRef.current.focus();
    }
  }, [disabled, state.activeCell]);

  const activeEntry = state.entries.find((e) => e.id === state.activeEntryId);
  const activeEntryCells = activeEntry ? getEntryCells(activeEntry) : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: 'CYCLE_ENTRY', reverse: e.shiftKey });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      dispatch({ type: 'TOGGLE_DIRECTION' });
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      dispatch({ type: 'MOVE_CURSOR', key: e.key as any });
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'BACKSPACE' });
      return;
    }

    // A-Z keys
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      dispatch({
        type: 'TYPE_LETTER',
        letter: e.key,
        onWordFilled,
      });
    }
  };

  // Progress = solved + assisted words over total entries
  const totalEntries = state.entries.length;
  const solvedCount = state.entries.filter(
    (e) => e.status === 'solved' || e.status === 'assisted'
  ).length;
  const progress = totalEntries > 0 ? (solvedCount / totalEntries) * 100 : 0;

  const cellSize = 'var(--s, 58px)';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div
      className="relative flex flex-col items-center select-none outline-none w-full"
      onClick={() => {
        if (window.matchMedia('(pointer: fine)').matches) {
          hiddenInputRef.current?.focus();
        }
      }}
    >
      {/* Hidden input to capture physical keyboard focus */}
      <input
        ref={hiddenInputRef}
        type="text"
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-hidden="true"
      />

      {/* Progress bar */}
      <div className="w-full max-w-md mb-4 px-2">
        <ProgressBar progress={progress} />
      </div>

      <div
        style={
          {
            '--s': `min(64px, calc((100vw - 64px - ${(state.cols - 1) * 6}px) / ${Math.max(state.cols, 1)}), calc((100dvh - 300px - ${(state.rows - 1) * 6}px) / ${Math.max(state.rows, 1)}))`,
            display: 'grid',
            gridTemplateColumns: `repeat(${state.cols}, ${cellSize})`,
            gridAutoRows: cellSize,
            gap: '6px',
            justifyContent: 'center',
          } as React.CSSProperties
        }
        role="grid"
        aria-label="Crossword Grid"
      >
        {state.cells.map((rowCells, r) =>
          rowCells.map((cell, c) => {
            if (cell.block) {
              // Transparent placeholder — still occupies the grid cell, no black block
              return (
                <div
                  key={`${r}-${c}`}
                  style={{ width: cellSize, height: cellSize }}
                  role="gridcell"
                  aria-hidden="true"
                />
              );
            }

            const isActive = state.activeCell?.row === r && state.activeCell?.col === c;
            const isInActiveEntry = activeEntryCells.some(
              (pos) => pos.row === r && pos.col === c
            );

            // Compute cell visual state by priority
            let cellBg = 'var(--cell-bg)';
            let cellShadow = '0 4px 0 var(--cell-edge)';
            let cellTransform = 'none';
            let cellZ = 1;

            if (cell.isWrong) {
              cellBg = 'var(--coral-soft)';
              cellShadow = '0 4px 0 var(--shadow-coral)';
            } else if (cell.isCorrectAnim) {
              cellBg = 'var(--mint-soft)';
              cellShadow = '0 4px 0 var(--shadow-mint-soft)';
            } else if (isActive) {
              cellBg = 'var(--yellow)';
              cellShadow = '0 4px 0 var(--orange)';
              cellTransform = 'scale(1.1)';
              cellZ = 10;
            } else if (cell.locked) {
              cellBg = 'var(--mint-soft)';
              cellShadow = '0 4px 0 var(--shadow-mint-soft)';
            } else if (isInActiveEntry) {
              cellBg = 'var(--blue-soft)';
            }

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => {
                  dispatch({ type: 'SELECT_CELL', row: r, col: c });
                  if (window.matchMedia('(pointer: fine)').matches) {
                    hiddenInputRef.current?.focus();
                  }
                }}
                style={
                  {
                    width: cellSize,
                    height: cellSize,
                    borderRadius: '12px',
                    background: cellBg,
                    boxShadow: cellShadow,
                    transform: cellTransform,
                    zIndex: cellZ,
                    color: 'var(--cell-text)',
                    fontSize: 'calc(var(--s, 58px) * 0.5)',
                    transition: 'transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                    ...(cell.isCorrectAnim && cell.animDelayMs
                      ? { animationDelay: `${cell.animDelayMs}ms` }
                      : {}),
                  } as React.CSSProperties
                }
                className={cn(
                  'relative flex items-center justify-center font-display font-bold focus:outline-none cursor-pointer',
                  cell.isCorrectAnim && 'animate-correct-pop',
                  cell.isWrong && 'animate-shake-wrong',
                  disabled && 'cursor-not-allowed'
                )}
                role="gridcell"
                aria-label={`Baris ${r + 1}, Kolom ${c + 1}${cell.number ? `, Nomor ${cell.number}` : ''}, Huruf ${cell.letter || 'kosong'}`}
              >
                {/* Cell Number badge */}
                {cell.number && (
                  <span
                    className="absolute font-display"
                    style={{
                      top: '-7px',
                      left: '-7px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '9999px',
                      background: 'var(--coral)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      boxShadow: '0 2px 0 rgba(0,0,0,0.2)',
                      zIndex: 2,
                    }}
                  >
                    {cell.number}
                  </span>
                )}

                {/* Letter */}
                <span
                  key={cell.letter}
                  className={cell.letter ? 'animate-pop' : ''}
                  style={{ lineHeight: 1, pointerEvents: 'none' }}
                >
                  {cell.letter}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Toast message (aria-live) */}
      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        toastKey={toast?.key ?? 0}
      />

      {/* Touch keyboard for phones and tablets */}
      <div
        className="mt-5 grid w-full max-w-xl grid-cols-7 gap-2 sm:hidden"
        aria-label="Papan ketik huruf"
      >
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              dispatch({ type: 'TYPE_LETTER', letter, onWordFilled });
            }}
            className="rounded-xl font-display font-bold active:translate-y-0.5 disabled:opacity-50"
            style={{
              minHeight: '44px',
              background: 'var(--cell-bg)',
              color: 'var(--cell-text)',
              boxShadow: '0 3px 0 var(--cell-edge)',
              fontSize: '18px',
              touchAction: 'manipulation',
            }}
            aria-label={`Huruf ${letter}`}
          >
            {letter}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: 'BACKSPACE' });
          }}
          className="col-span-2 rounded-xl font-display font-bold disabled:opacity-50"
          style={{ minHeight: '48px', background: 'var(--coral-soft)', color: 'var(--text)', fontSize: '16px', touchAction: 'manipulation' }}
        >
          Hapus ⌫
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: 'TOGGLE_DIRECTION' });
          }}
          className="col-span-3 rounded-xl font-display font-bold disabled:opacity-50"
          style={{ minHeight: '48px', background: 'var(--blue-soft)', color: 'var(--text)', fontSize: '16px', touchAction: 'manipulation' }}
        >
          Ganti arah ↕
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: 'MOVE_CURSOR', key: 'ArrowRight' });
          }}
          className="col-span-2 rounded-xl font-display font-bold disabled:opacity-50"
          style={{ minHeight: '48px', background: 'var(--yellow)', color: 'var(--text)', fontSize: '16px', touchAction: 'manipulation' }}
        >
          Pindah →
        </button>
      </div>

      {/* Keyboard help text */}
      <div
        className="mt-3 hidden text-center sm:block"
        style={{ fontSize: '15px', color: 'var(--text-sec)' }}
      >
        Ketik huruf A–Z · Panah untuk pindah · Tab ganti kata · Enter ganti arah
      </div>
    </div>
  );
};
