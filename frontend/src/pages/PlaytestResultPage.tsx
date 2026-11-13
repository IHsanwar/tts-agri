import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { formatScore, formatDuration } from '../lib/scoreFormat';
import { Trophy, Clock, CheckCircle2, Lightbulb, Home, RotateCcw } from 'lucide-react';

const DECOR_EMOJIS = [
  { emoji: '🏆', top: '10%', left: '5%' },
  { emoji: '🎉', top: '78%', left: '7%' },
  { emoji: '⭐', top: '14%', left: '92%' },
  { emoji: '📚', top: '72%', left: '90%' },
];

export const PlaytestResultPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    apiFetch('/playtest/result')
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-page-gradient flex items-center justify-center select-none">
        <div
          className="p-6 rounded-3xl text-center"
          style={{
            background: 'var(--card)',
            boxShadow: '0 6px 0 var(--edge)',
          }}
        >
          <span className="text-3xl animate-bounce inline-block mb-2" aria-hidden="true">⏱️</span>
          <div className="font-display font-bold text-lg text-slate-700 animate-pulse">
            Memuat hasil playtest...
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-page-gradient flex flex-col items-center justify-center p-4 select-none">
        <div
          className="max-w-sm w-full p-6 text-center"
          style={{
            background: 'var(--card)',
            borderRadius: '28px',
            boxShadow: '0 6px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.15)',
          }}
        >
          <span className="text-4xl block mb-2" aria-hidden="true">🔍</span>
          <h2 className="font-display text-xl font-bold text-slate-800">Hasil Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-2">
            Belum ada hasil playtest yang tercatat untuk sesi Anda.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-playful w-full mt-5"
            style={
              {
                background: 'var(--blue)',
                color: '#ffffff',
                '--btn-shadow': 'var(--shadow-blue)',
              } as React.CSSProperties
            }
          >
            <Home className="w-4 h-4" />
            <span>Ke Beranda</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-gradient flex flex-col justify-between p-4 md:p-8 relative overflow-hidden select-none">
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

      <header className="max-w-2xl mx-auto w-full text-center pb-4 relative z-10">
        <span className="inline-block text-3xl mb-1" aria-hidden="true">🎉</span>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-slate-800">
          HASIL PLAYTEST
        </h1>
        <p className="text-xs uppercase font-display font-semibold tracking-wider text-blue-600 mt-0.5">
          {result.puzzle_title}
        </p>
      </header>

      <main className="max-w-md mx-auto w-full my-auto py-6 relative z-10">
        <div
          className="p-6 md:p-8 text-center"
          style={{
            background: 'var(--card)',
            borderRadius: '28px',
            boxShadow: '0 6px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.15)',
          }}
        >
          <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center bg-amber-50 border-4 border-amber-200 shadow-sm animate-bounce">
            <Trophy className="w-10 h-10 text-amber-500" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-display font-bold text-xs">
            {result.player_name || 'Pemain'}
          </div>

          <div className="my-5 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60">
            <div className="text-xs font-display font-bold uppercase text-amber-800/80 mb-0.5">
              Skor Akhir
            </div>
            <div className="font-display text-5xl font-black text-amber-600 tabular-nums">
              {formatScore(result.score)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 py-3 mb-5">
            <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
              <span className="text-[11px] text-slate-500 font-display font-semibold uppercase">Terjawab</span>
              <strong className="text-base font-display font-bold text-slate-800">
                {result.solved_count}/{result.total_entries}
              </strong>
            </div>

            <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <Lightbulb className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-[11px] text-slate-500 font-display font-semibold uppercase">Hint</span>
              <strong className="text-base font-display font-bold text-slate-800">
                {result.hints_used}
              </strong>
            </div>

            <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <Clock className="w-5 h-5 text-blue-500 mb-1" />
              <span className="text-[11px] text-slate-500 font-display font-semibold uppercase">Waktu</span>
              <strong className="text-base font-display font-bold text-slate-800">
                {formatDuration(result.duration_seconds)}
              </strong>
            </div>
          </div>

          <div className="mb-5">
            <span
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-display font-bold shadow-xs ${
                result.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {result.status === 'completed' ? '✓ SELESAI SEMPURNA' : '⏱️ BELUM SELESAI'}
            </span>
          </div>

          <Link
            to="/"
            className="btn-playful w-full py-3.5"
            style={
              {
                background: 'var(--blue)',
                color: '#ffffff',
                '--btn-shadow': 'var(--shadow-blue)',
                fontSize: '15px',
                borderRadius: '9999px',
              } as React.CSSProperties
            }
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Halaman Utama</span>
          </Link>
        </div>
      </main>

      <footer className="max-w-2xl mx-auto w-full text-center text-xs text-slate-400 pt-4 relative z-10 font-medium">
        TTS Arena — Playtest Mode • IPB Moments
      </footer>
    </div>
  );
};
