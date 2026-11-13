import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client';
import { formatScore, formatDuration, formatTimeRemaining, formatDateTime } from '../../lib/scoreFormat';
import {
  Trophy,
  Clock,
  Radio,
  Play,
  DoorOpen,
  StopCircle,
  Download,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Ban,
  ArrowLeft,
  Users,
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const TeacherCompetitionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [competition, setCompetition] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Extend Modal
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(10);

  // Close Confirmation Modal
  const [isCloseOpen, setIsCloseOpen] = useState(false);

  // Void Modal
  const [voidSessionTarget, setVoidSessionTarget] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  // Countdown timer for running competition
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--');
  const [isUrgent, setIsUrgent] = useState(false);

  const fetchCompetition = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<any>(`/teacher/competitions/${id}`);
      setCompetition(data);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat detail kompetisi.');
    }
  }, [id]);

  const fetchSessions = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<any>(`/teacher/competitions/${id}/sessions`);
      setSessions(data.sessions || []);
    } catch {
      // Quiet fail on polling
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCompetition(), fetchSessions()]).finally(() => {
      setLoading(false);
    });
  }, [fetchCompetition, fetchSessions]);

  // Polling every 5s for live session monitor
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions();
      fetchCompetition();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions, fetchCompetition]);

  // Update timer display
  useEffect(() => {
    if (!competition?.ends_at || competition?.status !== 'running') {
      setTimeRemaining('--:--');
      return;
    }

    const updateTimer = () => {
      const res = formatTimeRemaining(competition.ends_at);
      setTimeRemaining(res.text);
      setIsUrgent(res.isUrgent);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [competition?.ends_at, competition?.status]);

  const handleOpenCompetition = async () => {
    if (!competition) return;
    setActionLoading(true);
    try {
      await apiFetch(`/teacher/competitions/${competition.id}/open`, { method: 'POST' });
      await fetchCompetition();
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Gagal membuka ruang tunggu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCompetition = async () => {
    if (!competition) return;
    if (
      !window.confirm(
        'Mulai kompetisi sekarang? Waktu pengerjaan akan langsung berjalan dan siswa yang telah bergabung dapat mulai menjawab.'
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await apiFetch(`/teacher/competitions/${competition.id}/start`, { method: 'POST' });
      await fetchCompetition();
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Gagal memulai kompetisi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competition) return;

    setActionLoading(true);
    try {
      await apiFetch(`/teacher/competitions/${competition.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ minutes: Number(extendMinutes) }),
      });
      setIsExtendOpen(false);
      await fetchCompetition();
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Gagal memperpanjang waktu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseCompetition = async () => {
    if (!competition) return;
    setActionLoading(true);
    try {
      await apiFetch(`/teacher/competitions/${competition.id}/close`, { method: 'POST' });
      setIsCloseOpen(false);
      await fetchCompetition();
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Gagal menutup kompetisi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidSessionTarget || !voidReason.trim()) return;

    setVoidLoading(true);
    try {
      await apiFetch(`/teacher/sessions/${voidSessionTarget.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      setVoidSessionTarget(null);
      setVoidReason('');
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Gagal mendiskualifikasi sesi.');
    } finally {
      setVoidLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!competition) return;
    try {
      const blob = await apiFetch<Blob>(`/teacher/competitions/${competition.id}/export.csv`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `competition-${competition.join_code}-results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh berkas CSV.');
    }
  };

  const copyJoinCode = () => {
    if (!competition) return;
    navigator.clipboard.writeText(competition.join_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyPublicLink = () => {
    if (!competition) return;
    const url = `${window.location.origin}/leaderboard/${competition.join_code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-16 text-center font-display font-bold text-lg text-slate-400 animate-pulse">
        Memuat detail kompetisi...
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="text-center py-16">
        <h2 className="font-display font-black text-xl text-slate-800">Kompetisi Tidak Ditemukan</h2>
        <Link to="/teacher/competitions" className="mt-4 inline-block font-display font-bold text-blue-600 hover:underline text-xs">
          ← Kembali ke daftar kompetisi
        </Link>
      </div>
    );
  }

  const isDraft = competition.status === 'draft';
  const isOpen = competition.status === 'open';
  const isRunning = competition.status === 'running';
  const isClosed = competition.status === 'closed';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between pb-2">
        <Link
          to="/teacher/competitions"
          className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Kompetisi</span>
        </Link>

        <div className="flex items-center gap-2">
          {competition.leaderboard_public && (
            <button
              type="button"
              onClick={copyPublicLink}
              className="btn-playful inline-flex items-center gap-1.5"
              style={
                {
                  background: 'var(--blue)',
                  color: '#ffffff',
                  '--btn-shadow': 'var(--shadow-blue)',
                  fontSize: '11px',
                  padding: '5px 12px',
                } as React.CSSProperties
              }
              title="Salin Tautan Papan Peringkat Publik"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Tautan Disalin!' : 'Bagikan Leaderboard'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-playful inline-flex items-center gap-1.5"
            style={
              {
                background: '#ffffff',
                color: '#334155',
                '--btn-shadow': 'var(--edge)',
                fontSize: '11px',
                padding: '5px 12px',
                border: '1px solid rgba(77, 150, 255, 0.2)',
              } as React.CSSProperties
            }
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 shadow-xs">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Hero Control Banner */}
      <div
        className="p-6 md:p-8"
        style={{
          background: 'var(--card)',
          borderRadius: '28px',
          boxShadow: '0 6px 0 var(--edge)',
          border: '2px solid rgba(77, 150, 255, 0.16)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Competition Info */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-700 shadow-xs">
                KODE: {competition.join_code}
              </span>
              <button
                type="button"
                onClick={copyJoinCode}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                title="Salin Kode Kompetisi"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Status Badge */}
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold bg-[#00c9a7]/15 text-[#008f75] border border-[#00c9a7]/30 animate-pulse">
                  <Radio className="w-3.5 h-3.5" />
                  BERJALAN
                </span>
              )}
              {isOpen && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold bg-[#ffc75f]/20 text-[#b57a00] border border-[#ffc75f]/40">
                  <Clock className="w-3.5 h-3.5" />
                  RUANG TUNGGU TERBUKA
                </span>
              )}
              {isDraft && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-display font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  DRAFT
                </span>
              )}
              {isClosed && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-display font-bold bg-slate-100 text-slate-400 border border-slate-200">
                  SELESAI / DITUTUP
                </span>
              )}
            </div>

            <h1 className="font-display font-black text-2xl md:text-3xl text-slate-900 tracking-tight">
              {competition.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
              <span>⏱️ Durasi: <strong className="text-slate-700">{competition.duration_minutes} Menit</strong></span>
              <span>•</span>
              <span>👥 Grup Terdaftar: <strong className="text-slate-700">{competition.groups?.length || 0}</strong></span>
              <span>•</span>
              <span>📅 Dibuat: {formatDateTime(competition.created_at)}</span>
            </div>
          </div>

          {/* Dynamic Timer / Action Center */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
            {isRunning && (
              <div className="text-center sm:text-right pr-2">
                <div className="text-[11px] font-display uppercase font-bold text-slate-400 tracking-wider">
                  Sisa Waktu
                </div>
                <div
                  className={cn(
                    'font-mono text-3xl md:text-4xl font-black tabular-nums tracking-tight',
                    isUrgent ? 'text-[#ff6b6b] animate-pulse' : 'text-slate-800'
                  )}
                >
                  {timeRemaining}
                </div>
              </div>
            )}

            {/* Action Buttons Based on Status Machine */}
            <div className="flex flex-col gap-2">
              {isDraft && (
                <button
                  type="button"
                  onClick={handleOpenCompetition}
                  disabled={actionLoading}
                  className="btn-playful flex items-center justify-center gap-2"
                  style={
                    {
                      background: 'var(--blue)',
                      color: '#ffffff',
                      '--btn-shadow': 'var(--shadow-blue)',
                      fontSize: '13px',
                      padding: '10px 20px',
                    } as React.CSSProperties
                  }
                >
                  <DoorOpen className="w-4 h-4" />
                  <span>{actionLoading ? 'Membuka...' : 'Buka Ruang Tunggu (Open)'}</span>
                </button>
              )}

              {isOpen && (
                <button
                  type="button"
                  onClick={handleStartCompetition}
                  disabled={actionLoading || sessions.length === 0}
                  className="btn-playful flex items-center justify-center gap-2"
                  style={
                    {
                      background: 'var(--mint)',
                      color: '#064e3b',
                      '--btn-shadow': 'var(--shadow-mint)',
                      fontSize: '13px',
                      padding: '10px 20px',
                      opacity: (actionLoading || sessions.length === 0) ? 0.6 : 1,
                    } as React.CSSProperties
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {actionLoading
                      ? 'Memulai...'
                      : sessions.length === 0
                      ? 'Menunggu Siswa Masuk...'
                      : `Mulai Kompetisi (${sessions.length} Siap)`}
                  </span>
                </button>
              )}

              {isRunning && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExtendOpen(true)}
                    className="btn-playful"
                    style={
                      {
                        background: 'var(--yellow)',
                        color: '#3d2600',
                        '--btn-shadow': 'var(--shadow-yellow)',
                        fontSize: '12px',
                        padding: '8px 16px',
                      } as React.CSSProperties
                    }
                  >
                    + Perpanjang
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCloseOpen(true)}
                    className="btn-playful"
                    style={
                      {
                        background: 'var(--coral)',
                        color: '#ffffff',
                        '--btn-shadow': 'var(--shadow-coral)',
                        fontSize: '12px',
                        padding: '8px 16px',
                      } as React.CSSProperties
                    }
                  >
                    Tutup Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Monitoring Table */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display font-black text-xl text-slate-900 flex items-center gap-2">
              <span>📊</span>
              <span>Papan Skor & Monitoring Sesi Peserta</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Data terbarui otomatis setiap 5 detik secara deterministik dari server.
            </p>
          </div>

          <div className="text-xs font-display font-bold text-slate-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c9a7] animate-ping" />
            <span className="text-[#008f75]">Live Polling Aktif</span>
          </div>
        </div>

        <div
          className="overflow-hidden"
          style={{
            background: 'var(--card)',
            borderRadius: '24px',
            boxShadow: '0 4px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.12)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-medium">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-display font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">Peringkat</th>
                  <th className="py-3.5 px-4">Grup Peserta</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-right">Skor</th>
                  <th className="py-3.5 px-3 text-center">Kata Selesai</th>
                  <th className="py-3.5 px-3 text-center">Hints</th>
                  <th className="py-3.5 px-3">Koneksi / Last Seen</th>
                  <th className="py-3.5 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <div className="font-display font-bold text-base text-slate-800">
                        {isDraft
                          ? 'Kompetisi Masih Berstatus Draft'
                          : 'Belum Ada Grup yang Bergabung'}
                      </div>
                      <div className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-medium">
                        {isDraft
                          ? 'Buka ruang tunggu terlebih dahulu agar siswa dapat bergabung menggunakan PIN grup.'
                          : `Siswa dapat memasukkan Kode Kompetisi "${competition.join_code}" pada halaman depan.`}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sessions.map((s, index) => {
                    const isVoided = s.status === 'voided';
                    const isCompleted = s.status === 'completed';

                    // Compute connection freshness
                    let connectionStatus = 'Aktif';
                    let isFresh = true;
                    if (s.last_seen_at) {
                      const diffSec = Math.floor(
                        (Date.now() - new Date(s.last_seen_at).getTime()) / 1000
                      );
                      if (diffSec > 60) {
                        connectionStatus = 'Offline (>1m)';
                        isFresh = false;
                      } else if (diffSec > 20) {
                        connectionStatus = `${diffSec}d lalu`;
                      } else {
                        connectionStatus = 'Online';
                      }
                    } else {
                      connectionStatus = 'Belum terhubung';
                      isFresh = false;
                    }

                    const rankMedal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

                    return (
                      <tr
                        key={s.id}
                        className={cn(
                          'hover:bg-blue-50/40 transition-colors',
                          isVoided && 'bg-red-50/40 opacity-60 line-through'
                        )}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-5 font-display font-bold text-base text-slate-800">
                          {isVoided ? (
                            <span className="text-[#ff6b6b] text-xs font-mono font-bold">VOID</span>
                          ) : rankMedal ? (
                            <span className="text-lg mr-1">{rankMedal}</span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </td>

                        {/* Group Name & Code */}
                        <td className="py-3.5 px-4">
                          <div className="font-display font-bold text-sm text-slate-900">
                            {s.group_name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            Kode: #{s.group_code}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          {isVoided ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold bg-red-100 text-red-600">
                              DISKUALIFIKASI
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold bg-[#00c9a7]/15 text-[#008f75]">
                              SELESAI
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold bg-slate-100 text-slate-600 uppercase">
                              {s.status}
                            </span>
                          )}
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-3 text-right font-display text-base font-black text-slate-900 tabular-nums">
                          {formatScore(s.score)}
                        </td>

                        {/* Solved entries */}
                        <td className="py-3.5 px-3 text-center font-display font-bold text-slate-700">
                          {s.solved_count}
                        </td>

                        {/* Hints used */}
                        <td className="py-3.5 px-3 text-center font-display text-slate-500">
                          {s.hints_count}
                        </td>

                        {/* Connection status */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-[11px]">
                            {isFresh ? (
                              <Wifi className="w-3.5 h-3.5 text-[#00c9a7] flex-shrink-0" />
                            ) : (
                              <WifiOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            )}
                            <span className={isFresh ? 'text-[#008f75] font-bold' : 'text-slate-400'}>
                              {connectionStatus}
                            </span>
                          </div>
                        </td>

                        {/* Actions (Void) */}
                        <td className="py-3.5 px-5 text-right">
                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidSessionTarget(s);
                                setVoidReason('');
                              }}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-xs font-display font-bold transition-colors inline-flex items-center gap-1"
                              title="Diskualifikasi sesi dan kecualikan dari peringkat"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Void</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Extend Competition Modal */}
      {isExtendOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 0 var(--edge)',
              border: '2px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-display font-black text-lg text-slate-900">
                Perpanjang Waktu Kompetisi
              </h2>
              <button
                type="button"
                onClick={() => setIsExtendOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 my-3 font-medium">
              Tambahan menit akan langsung disinkronkan ke seluruh sesi aktif peserta.
            </p>

            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExtendMinutes(mins)}
                    className={cn(
                      'py-2.5 rounded-xl font-display text-xs font-bold transition-all',
                      extendMinutes === mins
                        ? 'bg-blue-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Atau Masukkan Menit:
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={60}
                  value={extendMinutes}
                  onChange={(e) => setExtendMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-surface transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExtendOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-display font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--yellow)',
                      color: '#3d2600',
                      '--btn-shadow': 'var(--shadow-yellow)',
                      fontSize: '12px',
                      padding: '6px 18px',
                    } as React.CSSProperties
                  }
                >
                  {actionLoading ? 'Menyimpan...' : 'Perpanjang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Early Confirmation Modal */}
      {isCloseOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 0 var(--edge)',
              border: '2px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <h2 className="font-display font-black text-lg text-slate-900 mb-2">
              Tutup Kompetisi Lebih Awal?
            </h2>
            <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed">
              Kompetisi akan diakhiri seketika. Seluruh sesi pengerjaan yang belum selesai akan ditandai selesai (expired) dan hasil akhir akan difinalkan.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCloseOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-display font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCloseCompetition}
                disabled={actionLoading}
                className="btn-playful"
                style={
                  {
                    background: 'var(--coral)',
                    color: '#ffffff',
                    '--btn-shadow': 'var(--shadow-coral)',
                    fontSize: '12px',
                    padding: '6px 18px',
                  } as React.CSSProperties
                }
              >
                {actionLoading ? 'Menutup...' : 'Ya, Tutup Kompetisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Session Modal */}
      {voidSessionTarget && (
        <div className="fixed inset-0 z-50 bg-overlay/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 0 var(--edge)',
              border: '2px solid rgba(255, 107, 107, 0.3)',
            }}
          >
            <div className="flex items-center gap-2 text-[#ff6b6b] pb-2 border-b border-slate-100">
              <Ban className="w-5 h-5 flex-shrink-0" />
              <h2 className="font-display font-black text-lg">
                Diskualifikasi Grup (Void)
              </h2>
            </div>

            <form onSubmit={handleVoidSubmit} className="py-4 space-y-4">
              <div className="text-xs text-slate-700 font-medium">
                Anda akan mendiskualifikasi grup{' '}
                <strong className="text-slate-900 font-bold">{voidSessionTarget.group_name}</strong> (#{voidSessionTarget.group_code}). Grup ini akan dikeluarkan dari perhitungan peringkat papan pemenang.
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Alasan Diskualifikasi
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Contoh: Terindikasi kecurangan atau pelanggaran tata tertib lomba."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-surface transition-all"
                />
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[11px] font-medium">
                Tindakan diskualifikasi bersifat <strong>final</strong> dan akan dicatat dalam audit trail server.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoidSessionTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-display font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={voidLoading || !voidReason.trim()}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--coral)',
                      color: '#ffffff',
                      '--btn-shadow': 'var(--shadow-coral)',
                      fontSize: '12px',
                      padding: '6px 18px',
                      opacity: (voidLoading || !voidReason.trim()) ? 0.5 : 1,
                    } as React.CSSProperties
                  }
                >
                  {voidLoading ? 'Memproses...' : 'Terapkan Diskualifikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
