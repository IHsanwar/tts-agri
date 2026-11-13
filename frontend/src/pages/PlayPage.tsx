import React, { useReducer, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ttsReducer, CrosswordState, CrosswordEntry, getEntryCells } from '../features/tts/ttsReducer';
import { CrosswordGrid } from '../features/tts/CrosswordGrid';
import { ClueRail } from '../features/tts/ClueRail';
import { ScoreboardHeader } from '../features/tts/ScoreboardHeader';
import { HintDialog } from '../features/tts/HintDialog';
import { Confetti } from '../features/tts/Confetti';
import { ResultModal, ResultData } from '../features/tts/ResultModal';
import { ToastType } from '../features/tts/Toast';
import { apiFetch, ApiError } from '../api/client';
import { OutboxQueue } from '../lib/outbox';

const initialCrosswordState: CrosswordState = {
  rows: 0,
  cols: 0,
  cells: [],
  entries: [],
  activeCell: null,
  activeDirection: 'across',
  activeEntryId: null,
  score: 0,
  gameStatus: 'waiting',
};

const DECOR_EMOJIS: Array<{ emoji: string; top: string; left: string }> = [
  { emoji: '✏️', top: '14%', left: '3%' },
  { emoji: '📏', top: '68%', left: '5%' },
  { emoji: '📚', top: '20%', left: '92%' },
  { emoji: '⭐', top: '74%', left: '90%' },
];

export const PlayPage: React.FC<{ mode?: 'competition' | 'playtest' }> = ({ mode = 'competition' }) => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(ttsReducer, initialCrosswordState);

  const isPlaytest = mode === 'playtest';

  const stateEndpoint = isPlaytest ? '/playtest/state' : '/play/state';
  const resultPath = isPlaytest ? '/playtest/result' : '/result';
  const outboxId = isPlaytest ? 'playtest' : 'current_group';
  const outboxEndpoint = isPlaytest ? '/playtest/events' : '/play/events';

  const [metaName, setMetaName] = useState<string>('');
  const [subName, setSubName] = useState<string>('');
  const [subCode, setSubCode] = useState<string>('');

  const [deadlineIso, setDeadlineIso] = useState<string | null>(null);
  const [serverDeltaMs, setServerDeltaMs] = useState<number>(0);
  const [isSessionLost, setIsSessionLost] = useState<boolean>(false);
  const [outboxPending, setOutboxPending] = useState<number>(0);

  // Hint dialog
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [hintTargetEntry, setHintTargetEntry] = useState<CrosswordEntry | null>(null);

  // Toast + confetti (display-only; do not affect game logic)
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState<number>(0);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  const fireConfetti = useCallback(() => {
    setConfettiTrigger((k) => k + 1);
  }, []);

  const outboxRef = useRef<OutboxQueue | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Initialize Outbox Queue
  useEffect(() => {
    const queue = new OutboxQueue(outboxId, outboxEndpoint);
    outboxRef.current = queue;

    const unsubscribe = queue.subscribe((count) => {
      setOutboxPending(count);
    });

    return () => {
      unsubscribe();
    };
  }, [outboxId, outboxEndpoint]);

  // Fetch / Sync Play State from server
  const fetchPlayState = useCallback(async () => {
    try {
      const data = await apiFetch<any>(stateEndpoint);

      if (data.server_now_ms) {
        setServerDeltaMs(data.server_now_ms - Date.now());
      }

      if (isPlaytest) {
        setMetaName(data.puzzle_title || data.puzzle?.title || 'Playtest');
        setSubName(data.player_name || 'Player');
        setSubCode('');
      } else {
        setMetaName(data.competition?.name || 'Kompetisi');
        setSubName(data.group?.name || 'Grup');
        setSubCode(data.group?.code || '');
      }

      if (data.status === 'completed' || data.status === 'closed') {
        navigate(resultPath);
        return;
      }

      if (data.deadline_at) {
        setDeadlineIso(data.deadline_at);
      }

      if (data.puzzle) {
        if (!isInitializedRef.current) {
          dispatch({
            type: 'INIT_STATE',
            payload: {
              puzzle: data.puzzle,
              score: data.score || 0,
              status: data.status,
            },
          });
          isInitializedRef.current = true;
        } else {
          dispatch({
            type: 'SYNC_STATE',
            payload: {
              puzzle: data.puzzle,
              score: data.score || 0,
              status: data.status,
            },
          });
        }
      }

      // Flush any queued outbox events
      if (outboxRef.current) {
        outboxRef.current.flush(
          () => setIsSessionLost(true),
          (results, newScore, newStatus) => {
            dispatch({
              type: 'UPDATE_SCORE_STATUS',
              score: newScore,
              status: newStatus,
            });
            results.forEach((r) => {
              if (r.result?.entry_id) {
                dispatch({
                  type: 'APPLY_WORD_RESULT',
                  entryId: r.result.entry_id,
                  correct: !!r.result.correct,
                  answer: r.result.answer,
                });
                setTimeout(() => {
                  dispatch({ type: 'CLEAR_ANIMATIONS' });
                }, 1200);
              }
            });
          }
        );
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        setIsSessionLost(true);
      }
    }
  }, [navigate, stateEndpoint, resultPath, isPlaytest]);

  // Initial load
  useEffect(() => {
    fetchPlayState();
  }, [fetchPlayState]);

  // Polling loop: 2s when waiting, 5s when playing
  useEffect(() => {
    if (isSessionLost) return;

    const intervalMs = state.gameStatus === 'waiting' ? 2000 : 5000;
    const timer = setInterval(() => {
      fetchPlayState();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [state.gameStatus, isSessionLost, fetchPlayState]);

  // Auto-navigate when game is completed
  useEffect(() => {
    if (state.gameStatus === 'completed' || state.gameStatus === 'closed') {
      navigate(resultPath);
    }
  }, [state.gameStatus, navigate, resultPath]);

  // Event handlers
  const handleWordFilled = (entryId: string, letters: string) => {
    if (!outboxRef.current) return;

    const prevScore = state.score;

    outboxRef.current.enqueue('word_submit', { entry_id: entryId, letters });
    outboxRef.current.flush(
      () => setIsSessionLost(true),
      (results, newScore, newStatus) => {
        dispatch({ type: 'UPDATE_SCORE_STATUS', score: newScore, status: newStatus });
        results.forEach((r) => {
          if (r.result?.entry_id) {
            const isCorrect = !!r.result.correct;
            dispatch({
              type: 'APPLY_WORD_RESULT',
              entryId: r.result.entry_id,
              correct: isCorrect,
              answer: r.result.answer,
            });
            setTimeout(() => {
              dispatch({ type: 'CLEAR_ANIMATIONS' });
            }, 1200);

            // Toast + confetti (display only)
            if (isCorrect) {
              const delta = newScore - prevScore;
              showToast(`Mantap! ${delta > 0 ? '+' + delta : ''} poin 🎉`, 'success');
              fireConfetti();
            } else {
              showToast('Hampir! Coba lagi 💪', 'error');
            }
          }
        });
        if (newStatus === 'completed' || newStatus === 'closed') {
          navigate(resultPath);
        }
      }
    );
  };

  const handleRequestHintLetter = (entryId: string, cellIndex: number) => {
    if (!outboxRef.current) return;
    const prevScore = state.score;
    outboxRef.current.enqueue('hint_letter', { entry_id: entryId, cell_index: cellIndex });
    outboxRef.current.flush(
      () => setIsSessionLost(true),
      (results, newScore, newStatus) => {
        dispatch({ type: 'UPDATE_SCORE_STATUS', score: newScore, status: newStatus });
        const delta = newScore - prevScore;
        showToast(
          `Bantuan dipakai${delta !== 0 ? ', ' + (delta > 0 ? '+' : '') + delta + ' poin' : ''} 💪`,
          'warning'
        );
        results.forEach((r) => {
          if (r.accepted && r.result?.letter) {
            dispatch({
              type: 'APPLY_HINT_LETTER',
              entryId,
              cellIndex,
              letter: r.result.letter,
            });
          }
        });
        if (newStatus === 'completed' || newStatus === 'closed') {
          navigate(resultPath);
        }
      }
    );
  };

  const handleRequestHintWord = (entryId: string) => {
    if (!outboxRef.current) return;
    const prevScore = state.score;
    outboxRef.current.enqueue('hint_word', { entry_id: entryId });
    outboxRef.current.flush(
      () => setIsSessionLost(true),
      (results, newScore, newStatus) => {
        dispatch({ type: 'UPDATE_SCORE_STATUS', score: newScore, status: newStatus });
        const delta = newScore - prevScore;
        showToast(
          `Bantuan dipakai${delta !== 0 ? ', ' + (delta > 0 ? '+' : '') + delta + ' poin' : ''} 💪`,
          'warning'
        );
        results.forEach((r) => {
          if (r.accepted && r.result?.answer) {
            dispatch({
              type: 'APPLY_HINT_WORD',
              entryId,
              answer: r.result.answer,
            });
          }
        });
        if (newStatus === 'completed' || newStatus === 'closed') {
          navigate(resultPath);
        }
      }
    );
  };

  const handleFinishGame = async () => {
    try {
      if (isPlaytest) {
        await apiFetch('/playtest/finish', { method: 'POST' });
      }
    } catch {
      // ignore — try to fetch result anyway
    }
    try {
      const data = await apiFetch<any>('/playtest/result');
      const solved = data.solved_count ?? 0;
      const total = data.total_entries ?? state.entries.length;
      setResultData({
        solvedCount: solved,
        totalEntries: total,
        score: data.score ?? state.score,
        durationSeconds: data.duration_seconds ?? null,
        allCorrect: total > 0 && solved >= total,
        label: data.player_name || subName || 'Kerja bagus!',
      });
    } catch {
      navigate(resultPath);
    }
  };

  const activeEntry = state.entries.find((e) => e.id === state.activeEntryId) || null;

  const handleCheckActiveWord = () => {
    if (!activeEntry || !outboxRef.current) return;
    const cells = getEntryCells(activeEntry);
    const cellLetters = cells.map((c) => state.cells[c.row]?.[c.col]?.letter || '');
    const isAllFilled = cellLetters.every((l) => l.length === 1 && l.trim() !== '');
    if (isAllFilled && cellLetters.length === activeEntry.length) {
      handleWordFilled(activeEntry.id, cellLetters.join(''));
    } else {
      showToast('Isi semua kotaknya dulu ya 😊', 'info');
    }
  };

  // Selected cell relative index in active entry
  const selectedCellIndex = (() => {
    if (!activeEntry || !state.activeCell) return 0;
    const dr = activeEntry.direction === 'down' ? 1 : 0;
    const dc = activeEntry.direction === 'across' ? 1 : 0;
    for (let i = 0; i < activeEntry.length; i++) {
      if (
        activeEntry.row + dr * i === state.activeCell.row &&
        activeEntry.col + dc * i === state.activeCell.col
      ) {
        return i;
      }
    }
    return 0;
  })();

  // 1. Session Takeover Modal
  if (isSessionLost) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(20,30,60,0.45)', backdropFilter: 'blur(2px)' }}
      >
        <div
          className="max-w-sm w-full text-center"
          style={{
            background: 'var(--card)',
            borderRadius: '28px',
            padding: '28px 24px',
            boxShadow: '0 8px 0 var(--edge)',
          }}
        >
          <div aria-hidden="true" style={{ fontSize: '40px', marginBottom: '8px' }}>⚠️</div>
          <h2 className="font-display" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
            Sesi Telah Berakhir
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-sec)', marginTop: '8px', lineHeight: 1.5 }}>
            Sesi playtest Anda tidak lagi valid. Silakan mulai ulang sesi playtest.
          </p>
          <button
            type="button"
            onClick={() => navigate(isPlaytest ? '/' : '/')}
            className="btn-playful w-full mt-5"
            style={
              {
                background: 'var(--blue)',
                color: '#ffffff',
                '--btn-shadow': 'var(--shadow-blue)',
                fontSize: '15px',
              } as React.CSSProperties
            }
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // 2. Waiting Room State (competition only — playtest skips this)
  if (!isPlaytest && state.gameStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-page-gradient flex flex-col items-center justify-center p-4">
        <div
          className="max-w-md w-full text-center"
          style={{
            background: 'var(--card)',
            borderRadius: '28px',
            padding: '32px 28px',
            boxShadow: '0 8px 0 var(--edge)',
          }}
        >
          <div aria-hidden="true" style={{ fontSize: '44px', marginBottom: '10px' }}>⏳</div>
          <div
            className="font-display"
            style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-sec)', marginBottom: '4px' }}
          >
            {metaName}
          </div>
          <h2 className="font-display" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)' }}>
            Ruang Tunggu Peserta
          </h2>
          <div
            className="my-4"
            style={{
              padding: '12px 16px',
              borderRadius: '16px',
              background: 'var(--hover-soft)',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Grup:</span>{' '}
            <strong className="font-display" style={{ fontSize: '16px', color: 'var(--text)' }}>
              {subName}
            </strong>{' '}
            <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-sec)' }}>
              #{subCode}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-sec)', lineHeight: 1.6, marginBottom: '20px' }}>
            Anda telah berhasil bergabung! Mohon tunggu instruksi dari guru. Kompetisi akan dimulai serentak ketika guru menekan tombol <strong style={{ color: 'var(--text)' }}>Mulai</strong>.
          </p>
          <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-sec)' }}>
            Halaman ini akan otomatis beralih saat kompetisi dimulai...
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Crossword Game View
  return (
    <div className="min-h-screen bg-page-gradient flex flex-col relative">
      {/* Background decorations */}
      {DECOR_EMOJIS.map((d, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: d.top,
            left: d.left,
            fontSize: '44px',
            opacity: '0.12',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {d.emoji}
        </span>
      ))}

      {/* Confetti burst on correct word */}
      {confettiTrigger > 0 && (
        <Confetti key={confettiTrigger} onDone={() => setConfettiTrigger(0)} />
      )}

      <div className="relative z-10">
        <ScoreboardHeader
          competitionName={metaName}
          groupName={subName}
          groupCode={subCode}
          score={state.score}
          deadlineIso={deadlineIso}
          serverDeltaMs={serverDeltaMs}
          outboxPendingCount={outboxPending}
          onOpenHintModal={() => {
            setHintTargetEntry(activeEntry);
            setIsHintOpen(true);
          }}
          canRequestHint={!!activeEntry && activeEntry.status === 'unsolved'}
          onCheckActiveWord={activeEntry && activeEntry.status === 'unsolved' ? handleCheckActiveWord : undefined}
          onFinish={isPlaytest ? handleFinishGame : undefined}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Crossword Grid card */}
          <div
            className="lg:col-span-7 flex flex-col items-center justify-center min-h-[500px]"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              padding: '22px',
              boxShadow: '0 6px 0 var(--edge)',
            }}
          >
            <CrosswordGrid
              state={state}
              dispatch={dispatch}
              onWordFilled={handleWordFilled}
              disabled={state.gameStatus !== 'active'}
              toast={toast}
            />
          </div>

          {/* Right: Clue Rail */}
          <div className="lg:col-span-5 h-[560px]">
            <ClueRail
              entries={state.entries}
              activeEntryId={state.activeEntryId}
              dispatch={dispatch}
              onOpenHintDialog={(entry) => {
                setHintTargetEntry(entry);
                setIsHintOpen(true);
              }}
              disabled={state.gameStatus !== 'active'}
            />
          </div>
        </main>
      </div>

      {/* Hint Modal */}
      <HintDialog
        isOpen={isHintOpen}
        onClose={() => setIsHintOpen(false)}
        entry={hintTargetEntry}
        selectedCellIndex={selectedCellIndex}
        onRequestHintLetter={handleRequestHintLetter}
        onRequestHintWord={handleRequestHintWord}
      />

      {/* Result Modal (playtest Selesai) */}
      {resultData && (
        <ResultModal
          data={resultData}
          onPlayAgain={() => navigate('/')}
        />
      )}
    </div>
  );
};
