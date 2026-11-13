import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/scoreFormat';
import {
  Trophy,
  Plus,
  Radio,
  Clock,
  ArrowRight,
  Trash2,
  Users,
  FileQuestion,
  X,
  Check,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const TeacherCompetitionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [publishedPuzzles, setPublishedPuzzles] = useState<any[]>([]);
  const [activeGroups, setActiveGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create Competition Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<number | ''>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [leaderboardPublic, setLeaderboardPublic] = useState<boolean>(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiFetch<{ competitions: any[] }>('/teacher/competitions'),
      apiFetch<{ puzzles: any[] }>('/teacher/puzzles'),
      apiFetch<{ groups: any[] }>('/teacher/groups'),
    ])
      .then(([compRes, puzRes, grpRes]) => {
        setCompetitions(compRes.competitions || []);
        setPublishedPuzzles((puzRes.puzzles || []).filter((p) => p.status === 'published'));
        setActiveGroups((grpRes.groups || []).filter((g) => g.status === 'active'));
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Gagal memuat data kompetisi.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectAllGroups = () => {
    if (selectedGroupIds.length === activeGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(activeGroups.map((g) => g.id));
    }
  };

  const handleToggleGroup = (id: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!selectedPuzzleId) {
      setCreateError('Pilih puzzle yang telah dipublikasikan terlebih dahulu.');
      return;
    }

    if (selectedGroupIds.length === 0) {
      setCreateError('Pilih minimal satu grup peserta untuk kompetisi.');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await apiFetch<any>('/teacher/competitions', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          puzzle_set_id: Number(selectedPuzzleId),
          group_ids: selectedGroupIds,
          duration_minutes: Number(durationMinutes),
          leaderboard_public: Boolean(leaderboardPublic),
        }),
      });

      setIsCreateOpen(false);
      navigate(`/teacher/competitions/${res.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat kompetisi.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteDraft = async (compId: number, compName: string) => {
    if (!window.confirm(`Hapus draft kompetisi "${compName}"?`)) {
      return;
    }

    setActionLoading(compId);
    try {
      await apiFetch(`/teacher/competitions/${compId}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kompetisi.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold bg-[#00c9a7]/15 text-[#008f75] border border-[#00c9a7]/30 animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            BERJALAN
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold bg-[#ffc75f]/20 text-[#b57a00] border border-[#ffc75f]/40">
            <Clock className="w-3.5 h-3.5" />
            RUANG TUNGGU
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-display font-bold bg-slate-100 text-slate-600 border border-slate-200">
            DRAFT
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-display font-bold bg-slate-100 text-slate-400 border border-slate-200">
            SELESAI
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-slate-900 tracking-tight flex items-center gap-2">
            <span>🏆</span>
            <span>Manajemen Kompetisi</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Buat jadwal perlombaan, tentukan grup peserta, buka ruang tunggu, dan pantau jalannya game.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setName('');
            setSelectedPuzzleId(publishedPuzzles[0]?.id || '');
            setSelectedGroupIds(activeGroups.map((g) => g.id));
            setDurationMinutes(30);
            setLeaderboardPublic(false);
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="btn-playful self-start sm:self-auto"
          style={
            {
              background: 'var(--yellow)',
              color: '#3d2600',
              '--btn-shadow': 'var(--shadow-yellow)',
              fontSize: '13px',
              padding: '8px 18px',
            } as React.CSSProperties
          }
        >
          <Plus className="w-4 h-4" />
          <span>Buat Kompetisi Baru</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 shadow-xs">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Competitions Table */}
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
                <th className="py-3.5 px-5">Nama Kompetisi</th>
                <th className="py-3.5 px-3">Kode Masuk</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Durasi</th>
                <th className="py-3.5 px-3">Papan Publik</th>
                <th className="py-3.5 px-3">Dibuat Pada</th>
                <th className="py-3.5 px-5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-display animate-pulse">
                    Memuat daftar kompetisi...
                  </td>
                </tr>
              ) : competitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Trophy className="w-10 h-10 mx-auto text-amber-400 mb-2 opacity-80" />
                    <div className="font-display font-bold text-base text-slate-800">Belum Ada Kompetisi</div>
                    <div className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      Buat kompetisi pertama Anda untuk memulai turnamen teka-teki silang.
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(true)}
                      className="btn-playful"
                      style={
                        {
                          background: 'var(--blue)',
                          color: '#ffffff',
                          '--btn-shadow': 'var(--shadow-blue)',
                          fontSize: '12px',
                          padding: '6px 16px',
                        } as React.CSSProperties
                      }
                    >
                      Buat Kompetisi Pertama
                    </button>
                  </td>
                </tr>
              ) : (
                competitions.map((comp) => {
                  const isDraft = comp.status === 'draft';
                  return (
                    <tr key={comp.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-display font-bold text-sm text-slate-900">{comp.name}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-sm tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-blue-600 border border-slate-200">
                          {comp.join_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {getStatusBadge(comp.status)}
                      </td>
                      <td className="py-3.5 px-3 tabular-nums font-display font-bold text-slate-700">
                        {comp.duration_minutes} mnt
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[11px] text-slate-600">
                        {comp.leaderboard_public ? (
                          <span className="text-[#008f75] font-bold">✓ Ya</span>
                        ) : (
                          <span className="text-slate-400">Tidak</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-medium text-[11px]">
                        {formatDateTime(comp.created_at)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/teacher/competitions/${comp.id}`}
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
                          >
                            <span>Kelola & Monitor</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>

                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(comp.id, comp.name)}
                              disabled={actionLoading === comp.id}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus draft kompetisi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Competition Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg p-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 0 var(--edge)',
              border: '2px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <h2 className="font-display font-black text-lg text-slate-900">
                  Buat Kompetisi Baru
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span className="font-semibold">{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama Kompetisi
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Babak Penyisihan Kelas X-A"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-surface transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Pilih Puzzle (Hanya yang Sudah Dipublikasikan)
                </label>
                {publishedPuzzles.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
                    Belum ada puzzle yang dipublikasikan. Silakan publikasikan puzzle di menu{' '}
                    <Link to="/teacher/puzzles" className="font-bold underline text-amber-900">
                      Puzzle Sets
                    </Link>{' '}
                    terlebih dahulu.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedPuzzleId}
                    onChange={(e) => setSelectedPuzzleId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-surface transition-all"
                  >
                    {publishedPuzzles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (Versi: {p.version})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-surface transition-all"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={leaderboardPublic}
                      onChange={(e) => setLeaderboardPublic(e.target.checked)}
                      className="rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                    />
                    <span className="text-xs font-display font-bold text-slate-800">
                      Papan Publik
                    </span>
                  </label>
                </div>
              </div>

              {/* Group Multi-select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-display font-bold uppercase tracking-wider text-slate-700">
                    Pilih Grup Peserta ({selectedGroupIds.length}/{activeGroups.length})
                  </label>
                  {activeGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllGroups}
                      className="text-xs font-display font-bold text-blue-600 hover:underline"
                    >
                      {selectedGroupIds.length === activeGroups.length
                        ? 'Batalkan Semua'
                        : 'Pilih Semua'}
                    </button>
                  )}
                </div>

                {activeGroups.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
                    Belum ada grup aktif. Silakan buat grup di menu{' '}
                    <Link to="/teacher/groups" className="font-bold underline text-amber-900">
                      Grup Siswa
                    </Link>.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl p-2 bg-slate-50 max-h-40 overflow-y-auto space-y-1">
                    {activeGroups.map((g) => {
                      const isSelected = selectedGroupIds.includes(g.id);
                      return (
                        <div
                          key={g.id}
                          onClick={() => handleToggleGroup(g.id)}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer select-none transition-all',
                            isSelected
                              ? 'bg-blue-500 text-white font-bold shadow-xs'
                              : 'hover:bg-slate-200/70 text-slate-700'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("font-mono text-[11px]", isSelected ? "text-blue-100" : "text-slate-400")}>
                              #{g.group_code}
                            </span>
                            <span className="font-display">{g.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-display font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    createLoading ||
                    !name.trim() ||
                    !selectedPuzzleId ||
                    selectedGroupIds.length === 0
                  }
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--yellow)',
                      color: '#3d2600',
                      '--btn-shadow': 'var(--shadow-yellow)',
                      fontSize: '12px',
                      padding: '6px 18px',
                      opacity: (createLoading || !name.trim() || !selectedPuzzleId || selectedGroupIds.length === 0) ? 0.5 : 1,
                    } as React.CSSProperties
                  }
                >
                  {createLoading ? 'Membuat...' : 'Buat Kompetisi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
