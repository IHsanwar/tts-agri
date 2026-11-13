import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../../api/client';
import { Lock, Mail, User, Key, ArrowRight, ShieldAlert, GraduationCap, Home } from 'lucide-react';

const DECOR_EMOJIS = [
  { emoji: '🎓', top: '12%', left: '5%' },
  { emoji: '📚', top: '75%', left: '6%' },
  { emoji: '✏️', top: '18%', left: '92%' },
  { emoji: '⭐', top: '72%', left: '90%' },
];

export const TeacherRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 10) {
      setErrorMsg('Kata sandi harus minimal 10 karakter.');
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          invite_code: inviteCode.trim(),
        }),
      });
      navigate('/teacher');
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

      <header className="max-w-md mx-auto w-full text-center pb-4 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-800 font-display text-2xl font-black hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-[0_3px_0_#2f72d6]">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span>TTS ARENA GURU</span>
        </Link>
      </header>

      <main className="max-w-md mx-auto w-full my-auto py-6 relative z-10">
        <div
          className="p-6 md:p-8"
          style={{
            background: 'var(--card)',
            borderRadius: '28px',
            boxShadow: '0 6px 0 var(--edge)',
            border: '1px solid rgba(77, 150, 255, 0.15)',
          }}
        >
          <h2 className="font-display text-2xl font-bold text-slate-800 text-center mb-1">
            Pendaftaran Guru Baru
          </h2>
          <p className="text-xs text-slate-500 text-center mb-6 font-medium">
            Daftarkan akun guru menggunakan kode undangan sekolah.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2 shadow-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nama Lengkap & Gelar
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Budi Raharjo, S.Pd."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guru@sekolah.sch.id"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Kata Sandi (Minimal 10 Karakter)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 10 karakter"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Kode Undangan Sekolah (Invite Code)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Masukkan kode undangan sekolah..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name || !email || !password || !inviteCode}
              className="btn-playful w-full py-3.5 mt-2"
              style={
                {
                  background: 'var(--mint)',
                  color: 'var(--green-deep)',
                  '--btn-shadow': 'var(--shadow-mint)',
                  fontSize: '15px',
                  borderRadius: '9999px',
                } as React.CSSProperties
              }
            >
              <span>{loading ? 'Mendaftarkan...' : 'Daftar Akun Guru'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500 font-medium">
            Sudah memiliki akun?{' '}
            <Link to="/teacher/login" className="font-display font-bold text-blue-600 hover:text-blue-700">
              Masuk di sini
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-md mx-auto w-full text-center text-xs text-slate-400 pt-4 relative z-10 font-medium">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors">
          <Home className="w-3.5 h-3.5" />
          <span>Kembali ke Beranda Siswa</span>
        </Link>
      </footer>
    </div>
  );
};
