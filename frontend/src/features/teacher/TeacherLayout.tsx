import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import {
  GraduationCap,
  LayoutDashboard,
  FileQuestion,
  Users,
  Trophy,
  History,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ThemeToggle } from '../theme/ThemeToggle';

interface TeacherProfile {
  id: number;
  email: string;
  name: string;
}

const DECOR_EMOJIS = [
  { emoji: '✏️', top: '14%', left: '2%' },
  { emoji: '📏', top: '80%', left: '3%' },
  { emoji: '📚', top: '18%', left: '95%' },
  { emoji: '⭐', top: '78%', left: '94%' },
];

export const TeacherLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    apiFetch<{ teacher: TeacherProfile }>('/auth/me')
      .then((res) => {
        if (isMounted) {
          setTeacher(res.teacher);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          navigate('/teacher/login', { replace: true, state: { from: location } });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [navigate, location]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore error and proceed to login
    } finally {
      navigate('/teacher/login', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page-gradient flex items-center justify-center select-none">
        <div
          className="p-6 rounded-3xl text-center"
          style={{
            background: 'var(--card)',
            boxShadow: '0 6px 0 var(--edge)',
          }}
        >
          <span className="text-3xl animate-bounce inline-block mb-2" aria-hidden="true">🎓</span>
          <div className="font-display font-bold text-lg text-slate-700 animate-pulse">
            Memuat Portal Guru...
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/teacher', label: 'Ringkasan', icon: LayoutDashboard, end: true },
    { to: '/teacher/puzzles', label: 'Puzzle Sets', icon: FileQuestion },
    { to: '/teacher/groups', label: 'Grup Siswa', icon: Users },
    { to: '/teacher/competitions', label: 'Kompetisi', icon: Trophy },
    { to: '/teacher/audit', label: 'Audit Log', icon: History },
  ];

  return (
    <div className="min-h-screen bg-page-gradient flex flex-col font-sans text-slate-800 relative">
      {/* Background decorations */}
      {DECOR_EMOJIS.map((d, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: d.top,
            left: d.left,
            fontSize: '40px',
            opacity: '0.10',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {d.emoji}
        </span>
      ))}

      {/* Header bar */}
      <header className="sticky top-0 z-30 px-3 sm:px-6 pt-3 pb-2 backdrop-blur-md bg-surface/80 border-b border-blue-100/60 shadow-xs">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between pb-2.5">
            {/* Brand Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-[0_3px_0_#2f72d6] font-display font-bold text-lg">
                T
              </div>
              <div>
                <NavLink to="/teacher" className="font-display text-xl font-extrabold tracking-tight text-slate-800 hover:text-blue-600 transition-colors">
                  TTS ARENA GURU
                </NavLink>
                <div className="text-[10px] uppercase font-display font-bold tracking-wider text-blue-500">
                  Panel Manajemen & Monitoring
                </div>
              </div>
            </div>

            {/* Profile & Logout */}
            <div className="flex items-center gap-3">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-display font-bold transition-colors"
                title="Buka Halaman Siswa di tab baru"
              >
                <span>Halaman Siswa</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <ThemeToggle />

              <div className="h-6 w-px bg-slate-200 hidden md:block" />

              <div className="flex items-center gap-2.5 text-right">
                <div className="hidden sm:block">
                  <div className="text-xs font-display font-bold text-slate-800">{teacher?.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">{teacher?.email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn-playful"
                  style={
                    {
                      background: 'var(--coral-soft)',
                      color: 'var(--coral)',
                      '--btn-shadow': 'var(--shadow-coral)',
                      fontSize: '12px',
                      padding: '6px 14px',
                    } as React.CSSProperties
                  }
                  title="Keluar dari akun"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex space-x-1.5 sm:space-x-2 pt-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-display font-bold transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-blue-500 text-white shadow-[0_3px_0_#2f72d6]'
                        : 'text-slate-600 hover:bg-surface/80 hover:text-slate-900'
                    )
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <Outlet context={{ teacher }} />
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 font-medium relative z-10">
        TTS Arena — English Crossword Championship Platform • Guru Workspace
      </footer>
    </div>
  );
};
