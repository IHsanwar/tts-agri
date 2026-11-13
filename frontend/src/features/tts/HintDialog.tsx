import React, { useState } from 'react';
import { CrosswordEntry } from './ttsReducer';

interface HintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: CrosswordEntry | null;
  selectedCellIndex: number;
  onRequestHintLetter: (entryId: string, cellIndex: number) => void;
  onRequestHintWord: (entryId: string) => void;
}

export const HintDialog: React.FC<HintDialogProps> = ({
  isOpen,
  onClose,
  entry,
  selectedCellIndex,
  onRequestHintLetter,
  onRequestHintWord,
}) => {
  const [cellIdx, setCellIdx] = useState(selectedCellIndex);

  if (!isOpen || !entry) return null;

  const letterHintsRemaining = Math.max(0, 2 - entry.hints_used);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-pop"
      style={{ background: 'rgba(20,30,60,0.45)', backdropFilter: 'blur(2px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Bantuan kata"
    >
      <div
        className="relative w-full max-w-md"
        style={{
          background: 'var(--card)',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 8px 0 var(--edge)',
          color: 'var(--text)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute font-display"
          style={{
            top: '14px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-sec)',
            fontSize: '20px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden="true" style={{ fontSize: '20px' }}>💡</span>
          <h3 className="font-display" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
            Bantuan Kata
          </h3>
        </div>

        <div
          className="mb-4"
          style={{
            padding: '12px',
            borderRadius: '16px',
            background: 'var(--hover-soft)',
          }}
        >
          <div className="font-display" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '4px', fontSize: '14px' }}>
            {entry.number} {entry.direction.toUpperCase()} ({entry.length} huruf):
          </div>
          <div className="italic" style={{ color: 'var(--text)', fontSize: '14px' }}>
            {entry.clue_en}
          </div>
          <div className="italic" style={{ color: 'var(--text-sec)', fontSize: '13px', marginTop: '2px' }}>
            {entry.clue_id}
          </div>
        </div>

        <div className="space-y-3">
          {/* Option 1: Letter hint */}
          <div
            className="flex flex-col gap-2"
            style={{
              padding: '12px',
              borderRadius: '16px',
              background: 'var(--hover-soft)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-display" style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
                  Buka 1 Huruf
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>
                  Biaya: <strong style={{ color: 'var(--coral)' }}>−3 Poin</strong> · Sisa:{' '}
                  {letterHintsRemaining}/2 huruf
                </div>
              </div>
              <button
                type="button"
                disabled={letterHintsRemaining <= 0}
                onClick={() => {
                  onRequestHintLetter(entry.id, cellIdx);
                  onClose();
                }}
                className="btn-playful"
                style={
                  {
                    background: 'var(--blue)',
                    color: '#ffffff',
                    '--btn-shadow': 'var(--shadow-blue)',
                    fontSize: '14px',
                    padding: '8px 14px',
                  } as React.CSSProperties
                }
              >
                Buka Huruf
              </button>
            </div>

            {/* Cell Index Picker */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span style={{ fontSize: '11px', color: 'var(--text-sec)' }}>Pilih kotak ke-:</span>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: entry.length }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCellIdx(i)}
                    className="font-display"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      background: cellIdx === i ? 'var(--yellow)' : 'var(--card)',
                      color: cellIdx === i ? 'var(--brown)' : 'var(--text-sec)',
                      boxShadow: cellIdx === i ? '0 2px 0 var(--orange)' : '0 2px 0 var(--edge)',
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Option 2: Word hint */}
          <div
            className="flex items-center justify-between gap-2"
            style={{
              padding: '12px',
              borderRadius: '16px',
              background: 'var(--coral-soft)',
            }}
          >
            <div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: '15px', color: 'var(--coral)' }}>
                Buka Seluruh Kata
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>
                Biaya: <strong style={{ color: 'var(--coral)' }}>−10 Poin</strong> (ditandai Bantuan)
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Yakin ingin membuka seluruh kata? Anda akan kehilangan 10 poin.')) {
                  onRequestHintWord(entry.id);
                  onClose();
                }
              }}
              className="btn-playful"
              style={
                {
                  background: 'var(--coral)',
                  color: '#ffffff',
                  '--btn-shadow': 'var(--shadow-coral)',
                  fontSize: '14px',
                  padding: '8px 14px',
                } as React.CSSProperties
              }
            >
              Buka Kata
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5" style={{ fontSize: '11px', color: 'var(--text-sec)' }}>
          <span aria-hidden="true">⚠️</span>
          <span>Pengurangan poin langsung dicatat oleh server dan tidak dapat dibatalkan.</span>
        </div>
      </div>
    </div>
  );
};
