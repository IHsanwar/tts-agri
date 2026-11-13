import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { formatScore, formatDuration } from '../lib/scoreFormat';
import { Trophy, RefreshCw, Home, ShieldAlert } from 'lucide-react';

const DECOR_EMOJIS = [
  { emoji: '🏆', top: '10%', left: '4%' },
  { emoji: '⭐', top: '75%', left: '5%' },
  { emoji: '🎉', top: '16%', left: '92%' },
  { emoji: '📚', top: '78%', left: '90%' },
];

export const PublicLeaderboardPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLeaderboard = () => {
    if (!code) return;
    apiFetch(`/public/competitions/${code}/leaderboard`)
      .then((res) => {
        setData(res);
        setErrorMsg(null);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg('Gagal memuat papan peringkat.');
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, [code]);

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

      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl" aria-hidden="true">🏆</span>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">
              PAPAN PERINGKAT
            </h1>
          </div>
          <p className="text-xs font-display font-semibold text-blue-600 mt-0.5">
            {data?.competition_name || `Kompetisi #${code}`} • {data?.is_final ? 'Hasil Akhir' : 'Live Scoreboard'}
          </p>
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

      <main className="max-w-4xl mx-auto w-full my-6 flex-1 relative z-10">
        {loading && !data && (
          <div className="text-center py-16 font-display text-slate-600 animate-pulse text-lg">
            Memuat papan peringkat...
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 max-w-md mx-auto shadow-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {data && (
          <div
            className="overflow-hidden"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 6px 0 var(--edge)',
              border: '1px solid rgba(77, 150, 255, 0.15)',
            }}
          >
            <div className="px-5 py-3.5 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
              <span className="text-xs font-display font-bold text-slate-600">
                Total Grup: <strong className="text-blue-600">{data.leaderboard.length}</strong>
              </span>
              <span className="text-xs font-display text-slate-500 flex items-center gap-1.5 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                Live update 5s
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-display font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-20 text-center">Rank</th>
                    <th className="py-3 px-4">Nama Grup</th>
                    <th className="py-3 px-4 w-28">Kode</th>
                    <th className="py-3 px-4 w-32 text-right">Skor</th>
                    <th className="py-3 px-4 w-28 text-center">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {data.leaderboard.map((item: any) => (
                    <tr
                      key={item.group_code}
                      className={
                        item.rank === 1
                          ? 'bg-amber-50/60 font-semibold'
                          : item.rank === 2
                          ? 'bg-slate-50/50 font-semibold'
                          : item.rank === 3
                          ? 'bg-orange-50/30 font-semibold'
                          : 'hover:bg-blue-50/30 transition-colors'
                      }
                    >
                      <td className="py-3.5 px-4 text-center font-display font-bold text-sm">
                        {item.rank === 1 ? '🥇 1' : item.rank === 2 ? '🥈 2' : item.rank === 3 ? '🥉 3' : `#${item.rank}`}
                      </td>
                      <td className="py-3.5 px-4 font-display font-bold text-slate-800 text-sm">
                        {item.group_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">
                          #{item.group_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-display font-black text-lg tabular-nums text-amber-600">
                        {formatScore(item.score)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-display text-slate-600 font-semibold">
                        {formatDuration(item.duration_seconds)}
                      </td>
                    </tr>
                  ))}
                  {data.leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-display italic">
                        Belum ada data nilai peserta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400 pt-4 relative z-10 font-medium">
        TTS Arena — English Crossword Championship • IPB Moments
      </footer>
    </div>
  );
};

