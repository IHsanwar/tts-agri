import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  applyTheme,
  currentTheme,
  getStoredMode,
  onSystemThemeChange,
  type ResolvedTheme,
  type ThemeMode,
} from '../../lib/theme';

interface ThemeToggleProps {
  /** Extra classes for positioning within a header. */
  className?: string;
  /** Show the three-way segmented control instead of a single cycling button. */
  variant?: 'button' | 'segmented';
}

/**
 * Theme switcher. Light / Dark / System.
 * Dark mode must be explicit: the app's palette is driven by
 * <html data-theme>, not a media query, so "system" is a real third state.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = 'button',
}) => {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredMode());
  const [effective, setEffective] = useState<ResolvedTheme>(() => currentTheme());

  // Follow the OS while the user has chosen "system".
  useEffect(() => {
    if (mode !== 'system') return;
    return onSystemThemeChange(() => {
      setEffective(applyTheme('system'));
    });
  }, [mode]);

  const choose = (next: ThemeMode) => {
    setMode(next);
    setEffective(applyTheme(next));
  };

  const cycle = () => {
    // light -> dark -> system -> light, so the OS option is always reachable.
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    choose(order[(order.indexOf(mode) + 1) % order.length]);
  };

  const label = mode === 'system' ? `Sistem (${effective === 'dark' ? 'gelap' : 'terang'})` : mode === 'dark' ? 'Gelap' : 'Terang';

  if (variant === 'segmented') {
    const options: { value: ThemeMode; icon: React.ReactNode; title: string }[] = [
      { value: 'light', icon: <Sun className="w-3.5 h-3.5" />, title: 'Mode terang' },
      { value: 'dark', icon: <Moon className="w-3.5 h-3.5" />, title: 'Mode gelap' },
      { value: 'system', icon: <Monitor className="w-3.5 h-3.5" />, title: 'Ikuti sistem' },
    ];
    return (
      <div
        className={cn(
          'inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 border border-slate-200',
          className
        )}
        role="group"
        aria-label="Pilih tema tampilan"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            title={o.title}
            aria-pressed={mode === o.value}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              mode === o.value
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-surface'
            )}
          >
            {o.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Tema: ${label} — klik untuk ganti`}
      aria-label={`Tema saat ini ${label}. Klik untuk mengganti.`}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-bold',
        'bg-slate-100 text-slate-600 border border-slate-200',
        'hover:bg-slate-200 hover:text-slate-800 transition-colors',
        className
      )}
    >
      {mode === 'system' ? (
        <Monitor className="w-3.5 h-3.5" />
      ) : effective === 'dark' ? (
        <Moon className="w-3.5 h-3.5" />
      ) : (
        <Sun className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};
