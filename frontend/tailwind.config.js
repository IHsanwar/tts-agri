/** @type {import('tailwindcss').Config} */

// Colours that carry a theme meaning. Each is defined in index.css as an RGB
// channel triple (e.g. `--c-slate-50: 248 250 252`), so Tailwind can wrap it
// with <alpha-value>. That keeps opacity modifiers like `bg-slate-50/80`
// working while still flipping the colour with the theme.
const themed = {
  slate: {
    50: 'rgb(var(--c-slate-50) / <alpha-value>)',
    100: 'rgb(var(--c-slate-100) / <alpha-value>)',
    200: 'rgb(var(--c-slate-200) / <alpha-value>)',
    300: 'rgb(var(--c-slate-300) / <alpha-value>)',
    400: 'rgb(var(--c-slate-400) / <alpha-value>)',
    500: 'rgb(var(--c-slate-500) / <alpha-value>)',
    600: 'rgb(var(--c-slate-600) / <alpha-value>)',
    700: 'rgb(var(--c-slate-700) / <alpha-value>)',
    800: 'rgb(var(--c-slate-800) / <alpha-value>)',
    900: 'rgb(var(--c-slate-900) / <alpha-value>)',
  },
  blue: {
    50: 'rgb(var(--c-blue-50) / <alpha-value>)',
    100: 'rgb(var(--c-blue-100) / <alpha-value>)',
    200: 'rgb(var(--c-blue-200) / <alpha-value>)',
    300: 'rgb(var(--c-blue-300) / <alpha-value>)',
    400: 'rgb(var(--c-blue-400) / <alpha-value>)',
    500: 'rgb(var(--c-blue-500) / <alpha-value>)',
    600: 'rgb(var(--c-blue-600) / <alpha-value>)',
    700: 'rgb(var(--c-blue-700) / <alpha-value>)',
    800: 'rgb(var(--c-blue-800) / <alpha-value>)',
  },
  red: {
    50: 'rgb(var(--c-red-50) / <alpha-value>)',
    100: 'rgb(var(--c-red-100) / <alpha-value>)',
    200: 'rgb(var(--c-red-200) / <alpha-value>)',
    400: 'rgb(var(--c-red-400) / <alpha-value>)',
    500: 'rgb(var(--c-red-500) / <alpha-value>)',
    600: 'rgb(var(--c-red-600) / <alpha-value>)',
    800: 'rgb(var(--c-red-800) / <alpha-value>)',
  },
  amber: {
    50: 'rgb(var(--c-amber-50) / <alpha-value>)',
    100: 'rgb(var(--c-amber-100) / <alpha-value>)',
    200: 'rgb(var(--c-amber-200) / <alpha-value>)',
    300: 'rgb(var(--c-amber-300) / <alpha-value>)',
    400: 'rgb(var(--c-amber-400) / <alpha-value>)',
    500: 'rgb(var(--c-amber-500) / <alpha-value>)',
    600: 'rgb(var(--c-amber-600) / <alpha-value>)',
    700: 'rgb(var(--c-amber-700) / <alpha-value>)',
    800: 'rgb(var(--c-amber-800) / <alpha-value>)',
    900: 'rgb(var(--c-amber-900) / <alpha-value>)',
  },
  emerald: {
    100: 'rgb(var(--c-emerald-100) / <alpha-value>)',
    300: 'rgb(var(--c-emerald-300) / <alpha-value>)',
    500: 'rgb(var(--c-emerald-500) / <alpha-value>)',
    600: 'rgb(var(--c-emerald-600) / <alpha-value>)',
    700: 'rgb(var(--c-emerald-700) / <alpha-value>)',
    800: 'rgb(var(--c-emerald-800) / <alpha-value>)',
  },
  green: {
    600: 'rgb(var(--c-green-600) / <alpha-value>)',
  },
  orange: {
    50: 'rgb(var(--c-orange-50) / <alpha-value>)',
  },
  purple: {
    100: 'rgb(var(--c-purple-100) / <alpha-value>)',
    600: 'rgb(var(--c-purple-600) / <alpha-value>)',
  },
  rose: {
    500: 'rgb(var(--c-rose-500) / <alpha-value>)',
    600: 'rgb(var(--c-rose-600) / <alpha-value>)',
  },
  // `bg-surface` replaces a hardcoded `bg-white` so it flips in dark mode.
  surface: 'rgb(var(--white) / <alpha-value>)',
  // Fixed colours: never flip, so modal scrims and crossword blocks stay ink-dark.
  overlay: 'rgb(var(--c-overlay) / <alpha-value>)',
  block: 'rgb(var(--c-block) / <alpha-value>)',
  // Letter cells are deliberately light in BOTH themes (readability of letters).
  cell: 'var(--cell-bg)',
  'cell-ink': 'var(--cell-text)',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...themed,
        paper: {
          50: 'var(--card)',
          100: 'var(--page-soft)',
          200: 'var(--hover-soft)',
          300: 'var(--edge)',
        },
        ink: {
          900: 'var(--text)',
          800: 'var(--text)',
          700: 'var(--text)',
          500: 'var(--text-sec)',
          400: 'var(--text-sec)',
        },
        newspaper: {
          yellow: 'var(--yellow)',
          gold: 'var(--orange)',
          green: 'var(--mint)',
          coral: 'var(--coral)',
          amber: 'var(--orange)',
          blue: 'var(--blue)',
        },
        playful: {
          blue: 'var(--blue)',
          'blue-soft': 'var(--blue-soft)',
          yellow: 'var(--yellow)',
          orange: 'var(--orange)',
          mint: 'var(--mint)',
          'mint-soft': 'var(--mint-soft)',
          coral: 'var(--coral)',
          'coral-soft': 'var(--coral-soft)',
          edge: 'var(--edge)',
          card: 'var(--card)',
          text: 'var(--text)',
          'text-sec': 'var(--text-sec)',
          brown: 'var(--brown)',
          'green-deep': 'var(--green-deep)',
        },
      },
      fontFamily: {
        serif: ['Fredoka', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
