import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/scoreFormat';
import {
  Users,
  Plus,
  KeyRound,
  Edit2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Printer,
  X,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const TeacherGroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create Group Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // New PIN Display Modal (Shown ONCE after creation or reset)
  const [revealedPinData, setRevealedPinData] = useState<{
    groupName: string;
    groupCode: string;
    pin: string;
    isReset?: boolean;
  } | null>(null);

  // Edit Group Modal
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');
  const [editLoading, setEditLoading] = useState(false);

  // Print Cards Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchGroups = () => {
    setLoading(true);
    apiFetch<{ groups: any[] }>('/teacher/groups')
      .then((res) => {
        setGroups(res.groups || []);
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Gagal memuat daftar grup.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setCreateLoading(true);
    try {
      const res = await apiFetch<any>('/teacher/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      setIsCreateOpen(false);
      setNewGroupName('');
      setRevealedPinData({
        groupName: res.name,
        groupCode: res.group_code,
        pin: res.pin,
      });
      fetchGroups();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat grup.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPin = async (groupId: number, groupName: string, groupCode: string) => {
    if (
      !window.confirm(
        `Reset PIN untuk grup "${groupName}"? Tindakan ini akan mengakhiri sesi aktif perangkat grup tersebut.`
      )
    ) {
      return;
    }

    setActionLoading(groupId);
    try {
      const res = await apiFetch<any>(`/teacher/groups/${groupId}/reset-pin`, {
        method: 'POST',
      });

      setRevealedPinData({
        groupName: res.name || groupName,
        groupCode: res.group_code || groupCode,
        pin: res.pin,
        isReset: true,
      });
    } catch (err: any) {
      alert(err.message || 'Gagal mereset PIN.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEdit = (group: any) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditStatus(group.status);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editName.trim()) return;

    setEditLoading(true);
    try {
      await apiFetch(`/teacher/groups/${editingGroup.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          status: editStatus,
        }),
      });

      setEditingGroup(null);
      fetchGroups();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui grup.');
    } finally {
      setEditLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-blue-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">👥</span>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              Grup Siswa & Kredensial
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Daftarkan kelompok siswa, kelola PIN perangkat, dan cetak kartu akses kompetisi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
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
              <Printer className="w-4 h-4 text-blue-500" />
              <span>Cetak Kartu Akses</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn-playful"
            style={
              {
                background: 'var(--blue)',
                color: '#ffffff',
                '--btn-shadow': 'var(--shadow-blue)',
                fontSize: '13px',
                padding: '8px 18px',
              } as React.CSSProperties
            }
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Grup Baru</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 shadow-xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Groups Table */}
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
                <th className="py-3 px-4">Nama Grup</th>
                <th className="py-3 px-3">Kode Grup</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Dibuat Pada</th>
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-display animate-pulse">
                    Memuat daftar grup siswa...
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <div className="font-display font-bold text-base text-slate-800">Belum Ada Grup Siswa</div>
                    <div className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 font-medium">
                      Tambahkan grup siswa untuk kelas Anda sebelum memulai perlombaan.
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(true)}
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
                      Tambah Grup Pertama
                    </button>
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const isActive = group.status === 'active';
                  return (
                    <tr key={group.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-display font-bold text-sm text-slate-800">{group.name}</div>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-base tracking-wider text-blue-600">
                        {group.group_code}
                      </td>
                      <td className="py-3.5 px-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-display font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-display font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            NONAKTIF
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                        {formatDateTime(group.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResetPin(group.id, group.name, group.group_code)}
                            disabled={actionLoading === group.id}
                            className="btn-playful"
                            style={
                              {
                                background: 'var(--yellow)',
                                color: 'var(--brown)',
                                '--btn-shadow': 'var(--orange)',
                                fontSize: '11px',
                                padding: '5px 12px',
                              } as React.CSSProperties
                            }
                            title="Reset PIN dan invalidasi sesi aktif"
                          >
                            <KeyRound className="w-3 h-3 text-amber-700" />
                            <span>{actionLoading === group.id ? 'Resetting...' : 'Reset PIN'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(group)}
                            className="btn-playful"
                            style={
                              {
                                background: 'var(--card)',
                                color: 'var(--text)',
                                '--btn-shadow': 'var(--edge)',
                                fontSize: '11px',
                                padding: '5px 12px',
                              } as React.CSSProperties
                            }
                            title="Ubah Nama atau Status"
                          >
                            <Edit2 className="w-3 h-3 text-blue-500" />
                            <span>Edit</span>
                          </button>
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

      {/* Create Group Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-md w-full"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-800">
                Tambah Grup Siswa Baru
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nama Grup (Kelas / Tim)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Contoh: Kelompok Alpha, Tim Eagle"
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Kode grup 4 karakter dan PIN 6 digit akan dibuat otomatis oleh server.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--card)',
                      color: 'var(--text)',
                      '--btn-shadow': 'var(--edge)',
                      fontSize: '12px',
                      padding: '7px 16px',
                    } as React.CSSProperties
                  }
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newGroupName.trim()}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--blue)',
                      color: '#ffffff',
                      '--btn-shadow': 'var(--shadow-blue)',
                      fontSize: '12px',
                      padding: '7px 18px',
                    } as React.CSSProperties
                  }
                >
                  {createLoading ? 'Menyimpan...' : 'Buat Grup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Revealed Modal (Shown ONCE) */}
      {revealedPinData && (
        <div className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-md w-full text-center"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              border: '2px solid var(--yellow)',
            }}
          >
            <div className="pb-3 border-b border-slate-100">
              <span className="font-display text-xs font-bold text-amber-600 uppercase tracking-wider">
                {revealedPinData.isReset ? 'PIN Berhasil Direset' : 'Grup Berhasil Dibuat'}
              </span>
              <h2 className="font-display text-2xl font-black text-slate-800 mt-0.5">
                KREDENSIAL AKSES
              </h2>
            </div>

            <div className="py-4 space-y-4 text-center">
              <div>
                <div className="text-xs text-slate-400 font-display font-semibold uppercase tracking-wider">Nama Grup</div>
                <div className="font-display text-lg font-bold text-slate-800">{revealedPinData.groupName}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div>
                  <div className="text-[11px] uppercase font-display font-bold text-slate-500">Kode Grup</div>
                  <div className="font-mono text-2xl font-black text-blue-600 tracking-wider">
                    {revealedPinData.groupCode}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase font-display font-bold text-rose-500">PIN Rahasia</div>
                  <div className="font-mono text-2xl font-black text-rose-600 tracking-widest">
                    {revealedPinData.pin}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-start gap-2 text-left">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="font-medium">
                  <strong>PERHATIAN:</strong> PIN ini hanya ditampilkan <strong>SATU KALI</strong> pada sesi ini. Server menyimpannya secara terenkripsi (hash). Harap catat atau berikan ke kelompok siswa sekarang.
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Grup: ${revealedPinData.groupName}\nKode Grup: ${revealedPinData.groupCode}\nPIN: ${revealedPinData.pin}`,
                    'pin'
                  )
                }
                className="btn-playful w-full py-2.5"
                style={
                  {
                    background: 'var(--yellow)',
                    color: 'var(--brown)',
                    '--btn-shadow': 'var(--orange)',
                    fontSize: '13px',
                    borderRadius: '9999px',
                  } as React.CSSProperties
                }
              >
                {copiedText === 'pin' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span className="text-emerald-800">Berhasil Disalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Informasi Kredensial</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setRevealedPinData(null)}
                className="btn-playful w-full py-3"
                style={
                  {
                    background: 'var(--blue)',
                    color: '#ffffff',
                    '--btn-shadow': 'var(--shadow-blue)',
                    fontSize: '14px',
                    borderRadius: '9999px',
                  } as React.CSSProperties
                }
              >
                Saya Sudah Mencatat PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-md w-full"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-800">
                Ubah Grup #{editingGroup.group_code}
              </h2>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nama Grup
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Status Grup
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                >
                  <option value="active">Aktif (Dapat Diikutsertakan)</option>
                  <option value="disabled">Nonaktif</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--card)',
                      color: 'var(--text)',
                      '--btn-shadow': 'var(--edge)',
                      fontSize: '12px',
                      padding: '7px 16px',
                    } as React.CSSProperties
                  }
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading || !editName.trim()}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--blue)',
                      color: '#ffffff',
                      '--btn-shadow': 'var(--shadow-blue)',
                      fontSize: '12px',
                      padding: '7px 18px',
                    } as React.CSSProperties
                  }
                >
                  {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Cards Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-4xl w-full max-h-[90vh] flex flex-col"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-800">
                  Kartu Akses Grup Siswa
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Cetak atau potong kartu ini untuk dibagikan kepada masing-masing grup peserta.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--blue)',
                      color: '#ffffff',
                      '--btn-shadow': 'var(--shadow-blue)',
                      fontSize: '12px',
                      padding: '7px 16px',
                    } as React.CSSProperties
                  }
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Halaman</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups
                  .filter((g) => g.status === 'active')
                  .map((g) => (
                    <div
                      key={g.id}
                      className="border-2 border-dashed border-blue-200 p-4 bg-slate-50 rounded-2xl flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <span className="font-display font-black text-sm tracking-tight text-slate-800">TTS ARENA</span>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                          KODE: {g.group_code}
                        </span>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-display font-bold text-slate-400">Grup / Kelompok</div>
                        <div className="font-display text-base font-bold text-slate-800">{g.name}</div>
                      </div>

                      <div className="bg-surface p-3 rounded-xl border border-slate-200/80 text-xs space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Kode Kompetisi:</span>
                          <span className="font-bold underline text-blue-600">[Diisi Guru]</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Kode Grup:</span>
                          <span className="font-bold text-slate-800">{g.group_code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">PIN Grup:</span>
                          <span className="font-bold underline text-rose-500">[Diisi Guru]</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 text-center border-t border-slate-100 pt-1 font-medium">
                        Buka portal TTS Arena di browser laptop &bull; Masukkan kredensial di atas
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
