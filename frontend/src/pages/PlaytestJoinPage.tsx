import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { Gamepad2, ArrowRight, ShieldAlert, Sparkles, Home } from 'lucide-react';

const DECOR_EMOJIS = [
  { emoji: '🎮', top: '12%', left: '4%' },
  { emoji: '🧩', top: '75%', left: '6%' },
  { emoji: '✏️', top: '18%', left: '92%' },
  { emoji: '⭐', top: '72%', left: '90%' },
];

export const PlaytestJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [shareCode, setShareCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setShareCode(codeParam.trim().toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // Clear any stale playtest outbox queue from previous attempts
      try {
        localStorage.removeItem('tts_outbox_playtest');
      } catch {
        // ignore
      }

      await apiFetch('/playtest/' + shareCode.trim().toUpperCase() + '/join', {
        method: 'POST',
        body: JSON.stringify({
          player_name: playerName.trim() || undefined,
        }),
      });

      navigate('/playtest/play');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Gagal terhubung ke server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page-gradient flex flex-col justify-between p-4 md:p-8 relative overflow-hidden select-none">
      {/* Background playful floating emojis */}
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

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🎮</span>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">
              TTS ARENA
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold bg-blue-100 text-blue-700">
              <Sparkles className="w-3 h-3 text-blue-500" />
              Mode Playtest
            </span>
            <span className="text-xs text-slate-500 font-medium">— Latihan & Coba Puzzle</span>
          </div>
        </div>
        <Link
          to="/"
          className="btn-playful"
          style={
            {
              background: 'var(--card)',
              color: 'var(--text)',
              '--btn-shadow': 'var(--edge)',
              fontSize: '13px',
              padding: '8px 16px',
            } as React.CSSProperties
          }
        >
          <Home className="w-4 h-4 text-blue-500" />
          <span>Beranda</span>
        </Link>
      </header>

      {/* Main Join Box */}
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
          <div className="w-16 h-16 rounded-3xl mx-auto mb-3 flex items-center justify-center bg-blue-50 border-2 border-blue-200 shadow-sm">
            <Gamepad2 className="w-9 h-9 text-blue-500" />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-800">
            Masuk Mode Playtest
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Masukkan kode share dari guru untuk mencoba puzzle secara santai tanpa kompetisi.
          </p>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2 text-left">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="mt-6 space-y-4 text-left">
            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Kode Playtest
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                placeholder="CONTOH: PT1234"
                className="w-full px-4 py-3 bg-blue-50/40 border-2 border-blue-200/80 rounded-2xl font-mono text-center tracking-widest text-xl font-black text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nama Pemain (opsional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Tulis nama panggilan Anda..."
                className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !shareCode.trim()}
              className="btn-playful w-full py-3.5 mt-2"
              style={
                {
                  background: 'var(--mint)',
                  color: 'var(--green-deep)',
                  '--btn-shadow': 'var(--shadow-mint)',
                  fontSize: '16px',
                  borderRadius: '9999px',
                } as React.CSSProperties
              }
            >
              <span>{loading ? 'Menghubungkan...' : 'Mulai Bermain'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-800 font-medium">
            💡 Mode playtest tidak memerlukan grup atau PIN. Langsung main dan coba asah kosakatamu!
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400 pt-4 relative z-10 font-medium">
        TTS Arena — English Crossword Platform • IPB Moments
      </footer>
    </div>
  );
};
