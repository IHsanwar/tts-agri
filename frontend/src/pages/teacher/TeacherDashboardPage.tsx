import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/scoreFormat';
import {
  Trophy,
  FileQuestion,
  Users,
  History,
  Plus,
  ArrowRight,
  Clock,
  Radio,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      apiFetch<{ competitions: any[] }>('/teacher/competitions'),
      apiFetch<{ puzzles: any[] }>('/teacher/puzzles'),
      apiFetch<{ groups: any[] }>('/teacher/groups'),
      apiFetch<{ logs: any[] }>('/teacher/audit'),
    ])
      .then(([compRes, puzRes, grpRes, audRes]) => {
        if (!isMounted) return;
        setCompetitions(compRes.competitions || []);
        setPuzzles(puzRes.puzzles || []);
        setGroups(grpRes.groups || []);
        setRecentAudit((audRes.logs || []).slice(0, 6));
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg('Gagal memuat data ringkasan dashboard.');
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center font-display text-lg text-slate-600 animate-pulse">
        Memuat data dashboard...
      </div>
    );
  }

  const runningComps = competitions.filter((c) => c.status === 'running');
  const openComps = competitions.filter((c) => c.status === 'open');
  const publishedPuzzles = puzzles.filter((p) => p.status === 'published');
  const activeGroups = groups.filter((g) => g.status === 'active');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
            <Radio className="w-3 h-3" />
            BERJALAN
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold bg-blue-100 text-blue-700 border border-blue-300">
            <Clock className="w-3 h-3" />
            RUANG TUNGGU
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-display font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-display font-semibold bg-slate-100 text-slate-500">
            SELESAI
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-blue-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">📊</span>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              Ringkasan & Status Kompetisi
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Kelola jalannya perlombaan teka-teki silang bahasa Inggris secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/teacher/competitions"
            className="btn-playful"
            style={
              {
                background: 'var(--blue)',
                color: '#ffffff',
                '--btn-shadow': 'var(--shadow-blue)',
                fontSize: '13px',
                padding: '8px 16px',
              } as React.CSSProperties
            }
          >
            <Plus className="w-4 h-4" />
            <span>Kompetisi Baru</span>
          </Link>
          <Link
            to="/teacher/puzzles"
            className="btn-playful"
            style={
              {
                background: 'var(--yellow)',
                color: 'var(--brown)',
                '--btn-shadow': 'var(--orange)',
                fontSize: '13px',
                padding: '8px 16px',
              } as React.CSSProperties
            }
          >
            <FileQuestion className="w-4 h-4" />
            <span>Unggah Puzzle</span>
          </Link>
          <Link
            to="/teacher/groups"
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
            <Users className="w-4 h-4 text-blue-500" />
            <span>Grup Siswa</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Running */}
        <div
          className="p-5"
          style={{
            background: 'var(--card)',
            borderRadius: '24px',
            boxShadow: '0 4px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.12)',
          }}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs uppercase font-display font-bold tracking-wider">Sedang Berjalan</span>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-4xl font-black text-slate-800 tabular-nums">
            {runningComps.length}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            {openComps.length > 0 ? `${openComps.length} ruang tunggu terbuka` : 'Tidak ada sesi terbuka'}
          </div>
        </div>

        {/* Card 2: Competitions */}
        <div
          className="p-5"
          style={{
            background: 'var(--card)',
            borderRadius: '24px',
            boxShadow: '0 4px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.12)',
          }}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs uppercase font-display font-bold tracking-wider">Total Kompetisi</span>
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-4xl font-black text-slate-800 tabular-nums">
            {competitions.length}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            {competitions.filter((c) => c.status === 'closed').length} telah selesai
          </div>
        </div>

        {/* Card 3: Puzzles */}
        <div
          className="p-5"
          style={{
            background: 'var(--card)',
            borderRadius: '24px',
            boxShadow: '0 4px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.12)',
          }}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs uppercase font-display font-bold tracking-wider">Puzzle Siap Pakai</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <FileQuestion className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-4xl font-black text-slate-800 tabular-nums">
            {publishedPuzzles.length}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            dari total {puzzles.length} puzzle terdaftar
          </div>
        </div>

        {/* Card 4: Groups */}
        <div
          className="p-5"
          style={{
            background: 'var(--card)',
            borderRadius: '24px',
            boxShadow: '0 4px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.12)',
          }}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs uppercase font-display font-bold tracking-wider">Grup Siswa Aktif</span>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-4xl font-black text-slate-800 tabular-nums">
            {activeGroups.length}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            dari total {groups.length} grup kelas
          </div>
        </div>
      </div>

      {/* Active Competitions Spotlight */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-800 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500" />
            <span>Kompetisi Aktif & Terbuka</span>
          </h2>
          <Link
            to="/teacher/competitions"
            className="text-xs font-display font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Semua Kompetisi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {[...runningComps, ...openComps].length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              background: 'var(--card)',
              borderRadius: '24px',
              boxShadow: '0 4px 0 var(--edge)',
              border: '1px solid rgba(77, 150, 255, 0.12)',
            }}
          >
            <div className="w-12 h-12 rounded-full mx-auto mb-2 bg-slate-100 flex items-center justify-center text-slate-400">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-bold text-slate-800">
              Tidak Ada Kompetisi Aktif Saat Ini
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4 font-medium">
              Anda dapat membuka ruang tunggu atau memulai kompetisi baru untuk kelas Anda kapan saja.
            </p>
            <Link
              to="/teacher/competitions"
              className="btn-playful inline-flex"
              style={
                {
                  background: 'var(--blue)',
                  color: '#ffffff',
                  '--btn-shadow': 'var(--shadow-blue)',
                  fontSize: '13px',
                } as React.CSSProperties
              }
            >
              <Plus className="w-4 h-4" />
              <span>Buka Kompetisi Sekarang</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...runningComps, ...openComps].map((comp) => (
              <div
                key={comp.id}
                className="p-5 flex flex-col justify-between"
                style={{
                  background: 'var(--card)',
                  borderRadius: '24px',
                  boxShadow: '0 4px 0 var(--edge)',
                  border: '1px solid rgba(77, 150, 255, 0.15)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {getStatusBadge(comp.status)}
                    <span className="font-mono text-xs font-bold px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 tracking-wider">
                      KODE: {comp.join_code}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-800">
                    {comp.name}
                  </h3>
                  <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-3">
                    <span>Durasi: {comp.duration_minutes} Menit</span>
                    <span>•</span>
                    <span>Dibuat: {formatDateTime(comp.created_at)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-display font-medium text-slate-500">
                    {comp.leaderboard_public ? 'Papan Peringkat: Publik' : 'Papan Peringkat: Rahasia'}
                  </div>
                  <Link
                    to={`/teacher/competitions/${comp.id}`}
                    className="btn-playful"
                    style={
                      {
                        background: 'var(--blue)',
                        color: '#ffffff',
                        '--btn-shadow': 'var(--shadow-blue)',
                        fontSize: '12px',
                        padding: '6px 14px',
                      } as React.CSSProperties
                    }
                  >
                    <span>Masuk Monitor Live</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Two Column Layout: Recent Competitions & Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): All Recent Competitions Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-800">
              Riwayat Kompetisi Terbaru
            </h2>
            <Link
              to="/teacher/competitions"
              className="text-xs font-display font-bold text-blue-600 hover:text-blue-700"
            >
              Kelola Semua ({competitions.length})
            </Link>
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
                    <th className="py-3 px-4">Nama Kompetisi</th>
                    <th className="py-3 px-3">Kode</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Durasi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {competitions.slice(0, 5).map((comp) => (
                    <tr key={comp.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-display font-bold text-slate-800">
                        {comp.name}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-600">
                        {comp.join_code}
                      </td>
                      <td className="py-3.5 px-3">
                        {getStatusBadge(comp.status)}
                      </td>
                      <td className="py-3.5 px-3 tabular-nums text-slate-600">
                        {comp.duration_minutes} mnt
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/teacher/competitions/${comp.id}`}
                          className="font-display font-bold text-blue-600 hover:text-blue-700 text-xs"
                        >
                          Detail &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {competitions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-display italic">
                        Belum ada kompetisi yang dibuat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right (1 col): Recent Activity Trail */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <span>Aktivitas Guru</span>
            </h2>
            <Link
              to="/teacher/audit"
              className="text-xs font-display font-bold text-blue-600 hover:text-blue-700"
            >
              Audit Log Lengkap
            </Link>
          </div>

          <div
            className="p-4"
            style={{
              background: 'var(--card)',
              borderRadius: '24px',
              boxShadow: '0 4px 0 var(--edge)',
              border: '1px solid rgba(77, 150, 255, 0.12)',
            }}
          >
            {recentAudit.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-display italic">
                Belum ada catatan aktivitas.
              </div>
            ) : (
              <div className="space-y-3">
                {recentAudit.map((log) => (
                  <div
                    key={log.id}
                    className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-1 truncate text-[11px] font-medium">
                      Target: <span className="font-bold text-slate-700">{log.target_type}</span> ({log.target_id || '-'})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
