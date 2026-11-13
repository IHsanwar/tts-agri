/**
 * Theme handling.
 *
 * The effective theme is resolved into `data-theme` on <html> by a tiny inline
 * script in index.html before first paint, so there is no flash of the wrong
 * theme. This module reads that value, exposes it to React, and re-applies it.
 *
 * Stored preference can be 'light' | 'dark' | 'system'. 'system' follows
 * prefers-color-scheme and updates live when the OS preference changes.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'tts_theme';

export function getStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* localStorage can throw in private mode — fall through to default */
  }
  return 'system';
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemTheme() : mode;
}

/** Writes the effective theme to <html data-theme> and persists the mode. */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const effective = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', effective);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota/private-mode errors; the theme still applies for this page */
  }
  return effective;
}

export function currentTheme(): ResolvedTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Subscribe to OS theme changes. Returns an unsubscribe function. */
export function onSystemThemeChange(cb: (t: ResolvedTheme) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => cb(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
