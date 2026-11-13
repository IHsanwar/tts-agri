import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { Trophy, LogIn, ArrowRight, ShieldAlert, Gamepad2, Sparkles } from 'lucide-react';
import { ThemeToggle } from '../features/theme/ThemeToggle';

const DECOR_EMOJIS = [
  { emoji: '✏️', top: '12%', left: '4%' },
  { emoji: '📏', top: '75%', left: '5%' },
  { emoji: '📚', top: '18%', left: '92%' },
  { emoji: '⭐', top: '72%', left: '90%' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [competitionCode, setCompetitionCode] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await apiFetch<{
        status: string;
        competition: { name: string; status: string };
        group: { name: string; code: string };
      }>('/join', {
        method: 'POST',
        body: JSON.stringify({
          competition_code: competitionCode.trim().toUpperCase(),
          group_code: groupCode.trim().toUpperCase(),
          pin: pin.trim(),
        }),
      });

      if (res.status === 'closed') {
        navigate('/result');
      } else {
        navigate('/play');
      }
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
            <span className="text-2xl" aria-hidden="true">🏆</span>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">
              TTS ARENA
            </h1>
          </div>
          <p className="text-xs font-display font-semibold text-slate-500 mt-0.5">
            School English Crossword Championship
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle variant="segmented" />
          <Link
            to="/teacher/login"
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
            <LogIn className="w-3.5 h-3.5 text-blue-500" />
            <span>Area Guru</span>
          </Link>
        </div>
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
          <div className="w-16 h-16 rounded-3xl mx-auto mb-3 flex items-center justify-center bg-amber-50 border-2 border-amber-200 shadow-sm">
            <Trophy className="w-9 h-9 text-amber-500" />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-800">
            Masuk Arena Kompetisi
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Gunakan kode kompetisi, kode grup, dan PIN dari guru Anda.
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
                Kode Kompetisi (6 Karakter)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={competitionCode}
                onChange={(e) => setCompetitionCode(e.target.value.toUpperCase())}
                placeholder="CONTOH: KMP789"
                className="w-full px-4 py-3 bg-blue-50/40 border-2 border-blue-200/80 rounded-2xl font-mono text-center tracking-widest text-xl font-black text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Kode Grup
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
                  placeholder="G1A2"
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-center tracking-wider text-base font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  PIN Grup (6 Angka)
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-center tracking-widest text-base font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !competitionCode.trim() || !groupCode.trim() || !pin.trim()}
              className="btn-playful w-full py-3.5 mt-2"
              style={
                {
                  background: 'var(--blue)',
                  color: '#ffffff',
                  '--btn-shadow': 'var(--shadow-blue)',
                  fontSize: '16px',
                  borderRadius: '9999px',
                } as React.CSSProperties
              }
            >
              <span>{loading ? 'Memeriksa...' : 'Gabung Kompetisi'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Playtest Mode Shortcut */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Mau coba puzzle tanpa kompetisi?</span>
            <Link
              to="/playtest"
              className="inline-flex items-center gap-1 font-display font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Coba Playtest</span>
            </Link>
          </div>

          <div className="mt-4 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 font-medium">
            🔒 Hanya 1 perangkat aktif per grup. Menggunakan perangkat baru akan otomatis mengalihkan sesi.
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

