import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/scoreFormat';
import {
  FileQuestion,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  Check,
  Copy,
  Plus,
  X,
  FileCode,
  ShieldAlert,
  Gamepad2,
  Share2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const SAMPLE_PUZZLE_JSON = {
  schema_version: 1,
  version: "school-v1",
  title: "School Life",
  language: "en",
  grid: [
    "###G######",
    "##LESSON##",
    "###E##P###",
    "BOOK##E###",
    "###S##N###",
    "####DESK##",
    "##########",
    "##########",
    "##########",
    "##########"
  ],
  entries: [
    {
      id: "lesson",
      row: 1,
      col: 2,
      direction: "across",
      answer: "LESSON",
      clue_en: "A period of learning or teaching in a class.",
      clue_id: "Masa atau waktu pembelajaran di kelas."
    },
    {
      id: "book",
      row: 3,
      col: 0,
      direction: "across",
      answer: "BOOK",
      clue_en: "Bound pages used for reading or studying.",
      clue_id: "Kumpulan halaman bertuliskan untuk dibaca."
    },
    {
      id: "desk",
      row: 5,
      col: 4,
      direction: "across",
      answer: "DESK",
      clue_en: "A piece of furniture with a flat top used for study.",
      clue_id: "Meja tempat siswa belajar dan menulis."
    },
    {
      id: "geeks",
      row: 0,
      col: 3,
      direction: "down",
      answer: "GEEKS",
      clue_en: "Enthusiastic people obsessed with intellectual subjects.",
      clue_id: "Orang-orang yang sangat gemar belajar atau hal intelektual."
    },
    {
      id: "pen",
      row: 2,
      col: 6,
      direction: "down",
      answer: "PEN",
      clue_en: "An instrument for writing with ink.",
      clue_id: "Alat untuk menulis menggunakan tinta."
    }
  ]
};

export const TeacherPuzzlesPage: React.FC = () => {
  const navigate = useNavigate();
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  // Preview modal state
  const [previewPuzzle, setPreviewPuzzle] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Publish / Delete confirmation state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Share modal state
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePuzzleId, setSharePuzzleId] = useState<number | null>(null);
  const [copiedShareCode, setCopiedShareCode] = useState<string | null>(null);

  const fetchPuzzles = () => {
    setLoading(true);
    apiFetch<{ puzzles: any[] }>('/teacher/puzzles')
      .then((res) => {
        setPuzzles(res.puzzles || []);
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Gagal memuat daftar puzzle.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPuzzles();
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadLoading(true);
    setUploadErrors([]);
    setUploadWarnings([]);

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(jsonInput);
    } catch {
      setUploadErrors(['Format JSON tidak valid (syntax error).']);
      setUploadLoading(false);
      return;
    }

    try {
      const res = await apiFetch<any>('/teacher/puzzles', {
        method: 'POST',
        body: JSON.stringify(parsedJson),
      });

      if (res.warnings && res.warnings.length > 0) {
        setUploadWarnings(res.warnings);
      }
      setIsUploadOpen(false);
      setJsonInput('');
      fetchPuzzles();
    } catch (err: any) {
      if (err instanceof ApiError && err.details?.errors) {
        setUploadErrors(err.details.errors);
        if (err.details.warnings) {
          setUploadWarnings(err.details.warnings);
        }
      } else {
        setUploadErrors([err.message || 'Gagal mengunggah puzzle.']);
      }
    } finally {
      setUploadLoading(false);
    }
  };

  const handlePreview = async (puzzleId: number) => {
    setPreviewLoading(true);
    try {
      const res = await apiFetch<any>(`/teacher/puzzles/${puzzleId}`);
      setPreviewPuzzle(res);
    } catch (err: any) {
      alert(err.message || 'Gagal memuat preview puzzle.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePublish = async (puzzleId: number) => {
    if (!window.confirm('Publikasikan puzzle ini? Puzzle yang telah dipublikasikan bersifat permanen (immutable) dan dapat dipakai di kompetisi.')) {
      return;
    }
    setActionLoading(puzzleId);
    try {
      await apiFetch(`/teacher/puzzles/${puzzleId}/publish`, { method: 'POST' });
      fetchPuzzles();
    } catch (err: any) {
      alert(err.message || 'Gagal mempublikasikan puzzle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (puzzleId: number) => {
    if (!window.confirm('Hapus draft puzzle ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    setActionLoading(puzzleId);
    try {
      await apiFetch(`/teacher/puzzles/${puzzleId}`, { method: 'DELETE' });
      fetchPuzzles();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus puzzle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Copy SHA256
  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  // Share functionality
  const fetchShareLinks = (puzzleId: number) => {
    setShareLoading(true);
    apiFetch<{ links: any[] }>('/teacher/playtest/links')
      .then((res) => {
        const puzzleLinks = res.links.filter((l) => l.puzzle_id === puzzleId);
        setShareLinks(puzzleLinks);
      })
      .catch((err) => {
        console.error('Failed to load share links:', err);
      })
      .finally(() => {
        setShareLoading(false);
      });
  };

  const handleStartPlaytest = async (puzzleId: number) => {
    setActionLoading(puzzleId);
    try {
      try {
        localStorage.removeItem('tts_outbox_playtest');
      } catch {
        // ignore
      }
      await apiFetch(`/teacher/playtest/${puzzleId}/start`, { method: 'POST' });
      navigate('/playtest/play');
    } catch (err: any) {
      alert(err.message || 'Gagal memulai playtest.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateShare = (puzzleId: number) => {
    setSharePuzzleId(puzzleId);
    setIsShareModalOpen(true);
    fetchShareLinks(puzzleId);
  };

  const handleGenerateShareLink = async () => {
    if (!sharePuzzleId) return;
    setShareLoading(true);
    try {
      const res = await apiFetch<any>(`/teacher/playtest/${sharePuzzleId}/share`, { method: 'POST' });
      setShareLinks((curr) => [{ ...res, puzzle_id: sharePuzzleId }, ...curr]);
    } catch (err: any) {
      alert(err.message || 'Gagal membuat kode share.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleDeleteShare = async (linkId: number) => {
    if (!window.confirm('Hapus link share ini? Kode playtest akan hilang.')) {
      return;
    }
    setActionLoading(linkId);
    try {
      await apiFetch(`/teacher/playtest/links/${linkId}`, { method: 'DELETE' });
      setShareLinks((curr) => curr.filter((l) => l.id !== linkId));
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus link share.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyShareCode = async (link: any) => {
    const fullUrl = link.share_url || `${window.location.origin}/playtest?code=${link.share_code}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedShareCode(link.share_code);
    setTimeout(() => setCopiedShareCode(null), 2500);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-blue-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🧩</span>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              Bank Puzzle Teka-Teki Silang
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Unggah berkas JSON puzzle, validasi struktur kisi, preview jawaban, dan publikasikan untuk kompetisi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadErrors([]);
            setUploadWarnings([]);
            setIsUploadOpen(true);
          }}
          className="btn-playful self-start sm:self-auto"
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
          <Upload className="w-4 h-4" />
          <span>Unggah Puzzle JSON</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 shadow-xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Puzzle Table */}
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
                <th className="py-3 px-4">Judul & Versi</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Checksum SHA-256</th>
                <th className="py-3 px-3">Dibuat Pada</th>
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-display animate-pulse">
                    Memuat daftar puzzle...
                  </td>
                </tr>
              ) : puzzles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <FileQuestion className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <div className="font-display font-bold text-base text-slate-800">Belum Ada Puzzle</div>
                    <div className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 font-medium">
                      Mulai dengan mengunggah berkas JSON puzzle teka-teki silang Anda.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setJsonInput(JSON.stringify(SAMPLE_PUZZLE_JSON, null, 2));
                        setIsUploadOpen(true);
                      }}
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
                      Coba Sampel School V1
                    </button>
                  </td>
                </tr>
              ) : (
                puzzles.map((p) => {
                  const isPublished = p.status === 'published';
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-display font-bold text-sm text-slate-800">{p.title}</div>
                        <div className="font-mono text-[11px] text-blue-600 font-semibold">Versi: {p.version}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-display font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            PUBLISHED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-display font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            DRAFT
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                          <span>{p.sha256 ? `${p.sha256.substring(0, 10)}...` : '-'}</span>
                          {p.sha256 && (
                            <button
                              type="button"
                              onClick={() => handleCopySha(p.sha256)}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                              title="Salin SHA256 lengkap"
                            >
                              {copiedSha === p.sha256 ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                        {formatDateTime(p.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreview(p.id)}
                            disabled={previewLoading}
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
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span>Preview</span>
                          </button>

                  {!isPublished && (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePublish(p.id)}
                        disabled={actionLoading === p.id}
                        className="btn-playful"
                        style={
                          {
                            background: 'var(--mint)',
                            color: 'var(--green-deep)',
                            '--btn-shadow': 'var(--shadow-mint)',
                            fontSize: '11px',
                            padding: '5px 12px',
                          } as React.CSSProperties
                        }
                      >
                        {actionLoading === p.id ? 'Memproses...' : 'Publikasikan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        disabled={actionLoading === p.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                        title="Hapus draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* Playtest actions - only for published puzzles */}
                  {isPublished && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartPlaytest(p.id)}
                        disabled={actionLoading === p.id}
                        className="btn-playful"
                        style={
                          {
                            background: 'var(--blue)',
                            color: '#ffffff',
                            '--btn-shadow': 'var(--shadow-blue)',
                            fontSize: '11px',
                            padding: '5px 12px',
                          } as React.CSSProperties
                        }
                        title="Mulai playtest"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Playtest</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateShare(p.id)}
                        disabled={actionLoading === p.id}
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
                        title="Bagikan puzzle"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </>
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

      {/* Playtest Section */}
      <div
        className="p-6 mt-8"
        style={{
          background: 'var(--card)',
          borderRadius: '24px',
          boxShadow: '0 4px 0 var(--edge)',
          border: '1px solid rgba(77, 150, 255, 0.12)',
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b border-blue-100/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <h3 className="font-display text-lg font-bold text-slate-800">Fitur Playtest</h3>
          </div>
          <div className="text-xs text-slate-500 font-medium">Coba puzzle tanpa kompetisi — cocok untuk tes atau latihan mandiri.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Start Playtest (internal) */}
          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/70">
            <h4 className="font-display font-bold text-sm text-blue-700 mb-1.5">Mulai Sesi Playtest Pribadi</h4>
            <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
              Mulai sesi playtest langsung untuk Anda sendiri. Menguji kisi, petunjuk, dan alur gameplay tanpa kompetisi.
            </p>
            <div className="space-y-2.5">
              {puzzles.filter((p) => p.status === 'published').map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleStartPlaytest(p.id)}
                  disabled={actionLoading === p.id}
                  className="btn-playful w-full py-2.5"
                  style={
                    {
                      background: 'var(--blue)',
                      color: '#ffffff',
                      '--btn-shadow': 'var(--shadow-blue)',
                      fontSize: '13px',
                      borderRadius: '9999px',
                    } as React.CSSProperties
                  }
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>{actionLoading === p.id ? 'Memproses...' : 'Mulai Playtest: ' + p.title}</span>
                </button>
              ))}
              {puzzles.filter((p) => p.status === 'published').length === 0 && (
                <div className="text-xs text-slate-400 font-display italic">
                  Belum ada puzzle yang dipublikasikan. Publikasikan terlebih dahulu untuk playtest.
                </div>
              )}
            </div>
          </div>

          {/* Create Public Share Link */}
          <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100/70">
            <h4 className="font-display font-bold text-sm text-amber-800 mb-1.5">Bagikan Puzzle ke Publik</h4>
            <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
              Buat kode shareable playtest yang bisa dibuka siapa saja (tanpa perlu grup atau PIN) untuk bermain secara santai.
            </p>
            <button
              type="button"
              disabled={shareLoading}
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
              onClick={() => {
                const published = puzzles.filter((p) => p.status === 'published');
                if (published.length === 0) {
                  alert('Publikasikan minimal satu puzzle terlebih dahulu.');
                  return;
                }
                setSharePuzzleId(published[0].id);
                setIsShareModalOpen(true);
                fetchShareLinks(published[0].id);
              }}
            >
              <Share2 className="w-4 h-4" />
              <span>{shareLoading ? 'Memuat...' : 'Kelola & Buat Kode Share'}</span>
            </button>
          </div>
        </div>
      </div>



      {/* Upload Puzzle Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-2xl w-full max-h-[90vh] flex flex-col"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Upload className="w-4 h-4" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-800">
                  Unggah Berkas Puzzle JSON
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold font-display">
                  Tempelkan JSON puzzle atau pilih berkas:
                </span>
                <button
                  type="button"
                  onClick={() => setJsonInput(JSON.stringify(SAMPLE_PUZZLE_JSON, null, 2))}
                  className="font-display text-xs text-blue-600 hover:underline font-bold"
                >
                  [Gunakan Contoh School V1]
                </button>
              </div>

              <textarea
                required
                rows={12}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{\n  "schema_version": 1,\n  "version": "school-v1",\n  "title": "School Life",\n  "language": "en",\n  "grid": [...],\n  "entries": [...]\n}'
                className="w-full font-mono text-xs p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 leading-relaxed text-slate-800"
              />

              {uploadErrors.length > 0 && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs space-y-1">
                  <div className="font-display font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>Terdapat Kesalahan Validasi:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-2 font-mono">
                    {uploadErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadWarnings.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs space-y-1">
                  <div className="font-display font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Peringatan (Tidak Memblokir):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-2 font-mono">
                    {uploadWarnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
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
                  disabled={uploadLoading || !jsonInput.trim()}
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
                  <Check className="w-4 h-4" />
                  <span>{uploadLoading ? 'Memvalidasi...' : 'Simpan Sebagai Draft'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPuzzle && (
        <div className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-4xl w-full max-h-[92vh] flex flex-col"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-slate-800">
                    Preview: {previewPuzzle.title}
                  </h2>
                  <span className="font-mono text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full">
                    {previewPuzzle.version}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Kisi: {previewPuzzle.preview?.rows} × {previewPuzzle.preview?.cols} | Kunci Jawaban Lengkap (Guru View)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPuzzle(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {/* Visual Crossword Grid Preview */}
              <div className="flex justify-center p-5 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto">
                <div
                  className="inline-grid gap-1 bg-block p-1.5 rounded-xl shadow-inner"
                  style={{
                    gridTemplateColumns: `repeat(${previewPuzzle.preview?.cols || 10}, minmax(32px, 36px))`,
                  }}
                >
                  {(() => {
                    const rows = previewPuzzle.preview?.rows || 0;
                    const cols = previewPuzzle.preview?.cols || 0;
                    const gridRaw: string[] = previewPuzzle.content?.grid || [];
                    const cellNums = previewPuzzle.preview?.cell_numbers || {};

                    const cells = [];
                    for (let r = 0; r < rows; r++) {
                      const rowStr = gridRaw[r] || '';
                      for (let c = 0; c < cols; c++) {
                        const char = rowStr[c] || '#';
                        const isBlock = char === '#';
                        const num = cellNums[`${r},${c}`];

                        cells.push(
                          <div
                            key={`${r}-${c}`}
                            className={cn(
                              'w-8 h-8 sm:w-9 sm:h-9 relative flex items-center justify-center font-bold text-sm select-none rounded-md',
                              isBlock ? 'bg-block' : 'bg-cell text-cell-ink shadow-xs'
                            )}
                          >
                            {!isBlock && num && (
                              <span className="absolute top-0.5 left-0.5 text-[8px] font-mono text-slate-400 leading-none">
                                {num}
                              </span>
                            )}
                            {!isBlock && (
                              <span className="font-display font-black uppercase text-blue-600">{char}</span>
                            )}
                          </div>
                        );
                      }
                    }
                    return cells;
                  })()}
                </div>
              </div>

              {/* Clues Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Across */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-display font-bold text-sm text-slate-800 mb-2 pb-1 border-b border-slate-200">
                    Mendatar (Across)
                  </h3>
                  <div className="space-y-2 text-xs">
                    {(previewPuzzle.preview?.entries || [])
                      .filter((e: any) => e.direction === 'across')
                      .map((e: any) => (
                        <div key={e.id} className="pb-2 border-b border-slate-100 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-700">{e.number}.</span>
                            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              {e.answer}
                            </span>
                          </div>
                          <div className="text-slate-800 italic mt-0.5 font-medium">{e.clue_en}</div>
                          <div className="text-slate-500 text-[11px]">{e.clue_id}</div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Down */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-display font-bold text-sm text-slate-800 mb-2 pb-1 border-b border-slate-200">
                    Menurun (Down)
                  </h3>
                  <div className="space-y-2 text-xs">
                    {(previewPuzzle.preview?.entries || [])
                      .filter((e: any) => e.direction === 'down')
                      .map((e: any) => (
                        <div key={e.id} className="pb-2 border-b border-slate-100 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-700">{e.number}.</span>
                            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              {e.answer}
                            </span>
                          </div>
                          <div className="text-slate-800 italic mt-0.5 font-medium">{e.clue_en}</div>
                          <div className="text-slate-500 text-[11px]">{e.clue_id}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPuzzle(null)}
                className="btn-playful"
                style={
                  {
                    background: 'var(--card)',
                    color: 'var(--text)',
                    '--btn-shadow': 'var(--edge)',
                    fontSize: '13px',
                    padding: '8px 18px',
                  } as React.CSSProperties
                }
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Links Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="p-6 max-w-2xl w-full max-h-[90vh] flex flex-col"
            style={{
              background: 'var(--card)',
              borderRadius: '28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Share2 className="w-4 h-4" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-800">
                  Bagikan Puzzle Playtest
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-3 pb-2 flex items-center justify-between border-b border-slate-100 gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Pemain dapat langsung membuka link tanpa login atau input PIN kelompok.
              </span>
              <button
                type="button"
                onClick={handleGenerateShareLink}
                disabled={shareLoading}
                className="btn-playful whitespace-nowrap"
                style={
                  {
                    background: 'var(--yellow)',
                    color: 'var(--brown)',
                    '--btn-shadow': 'var(--orange)',
                    fontSize: '12px',
                    padding: '6px 14px',
                  } as React.CSSProperties
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{shareLoading ? 'Membuat...' : 'Buat Kode Baru'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {shareLoading && shareLinks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-display animate-pulse">Memuat link playtest...</div>
              ) : shareLinks.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-display">
                  Belum ada link share untuk puzzle ini.
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    Klik tombol "Buat Kode Baru" di atas untuk menghasilkan link shareable.
                  </p>
                </div>
              ) : (
                shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                          Kode: {link.share_code}
                        </span>
                        <span className={`text-[11px] font-display font-bold px-2.5 py-0.5 rounded-full ${link.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {link.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Hapus link share ini?')) {
                            handleDeleteShare(link.id);
                          }
                        }}
                        disabled={actionLoading === link.id}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                        title="Hapus link share"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* URL Input Box with Copy Button */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={link.share_url || `${window.location.origin}/playtest?code=${link.share_code}`}
                        className="flex-1 px-3 py-2 bg-surface border border-slate-200 rounded-xl font-mono text-xs text-slate-700 select-all focus:outline-none"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyShareCode(link)}
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
                        {copiedShareCode === link.share_code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Link</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      Dibuat: {formatDateTime(link.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="btn-playful"
                style={
                  {
                    background: 'var(--card)',
                    color: 'var(--text)',
                    '--btn-shadow': 'var(--edge)',
                    fontSize: '13px',
                    padding: '7px 18px',
                  } as React.CSSProperties
                }
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

