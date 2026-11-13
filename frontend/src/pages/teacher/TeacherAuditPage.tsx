import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/scoreFormat';
import { History, RefreshCw, ShieldAlert, Code2, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export const TeacherAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = () => {
    setLoading(true);
    apiFetch<{ logs: any[] }>('/teacher/audit')
      .then((res) => {
        setLogs(res.logs || []);
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Gagal memuat catatan audit log.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('void')) return 'bg-red-50 text-red-600 border-red-200';
    if (action.includes('start')) return 'bg-[#00c9a7]/15 text-[#008f75] border-[#00c9a7]/30';
    if (action.includes('open') || action.includes('publish')) return 'bg-blue-50 text-blue-600 border-blue-200';
    if (action.includes('delete')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-slate-900 tracking-tight flex items-center gap-2">
            <span>📜</span>
            <span>Audit Trail & Jejak Aktivitas</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Log kepatuhan dan histori tindakan krusial guru yang tercatat secara permanen di server.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="btn-playful self-start sm:self-auto inline-flex items-center gap-1.5"
          style={
            {
              background: '#ffffff',
              color: '#334155',
              '--btn-shadow': 'var(--edge)',
              fontSize: '12px',
              padding: '7px 16px',
              border: '1px solid rgba(77, 150, 255, 0.2)',
            } as React.CSSProperties
          }
        >
          <RefreshCw className={cn('w-4 h-4 text-blue-600', loading && 'animate-spin')} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs flex items-center gap-2 shadow-xs">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Audit Log Table */}
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
                <th className="py-3.5 px-5">Waktu (UTC/Lokal)</th>
                <th className="py-3.5 px-3">Aksi</th>
                <th className="py-3.5 px-3">Target</th>
                <th className="py-3.5 px-4">Metadata & Detail</th>
                <th className="py-3.5 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-display animate-pulse">
                    Memuat catatan audit...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-display">
                    Belum ada riwayat aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={cn(
                          'inline-block px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold border tracking-wider',
                          getActionColor(log.action)
                        )}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-800 text-[11px]">
                      <div className="font-display font-bold">{log.target_type}</div>
                      {log.target_id && (
                        <div className="text-[10px] font-mono text-slate-400">ID: {log.target_id}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 text-[11px]">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <div className="max-w-md bg-slate-50 p-2 rounded-xl border border-slate-200 overflow-x-auto text-[10px] font-mono text-slate-700">
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                      {log.ip || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
