import React from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

const COLOR_MAP: Record<ToastType, string> = {
  success: 'var(--mint)',
  error: 'var(--coral)',
  info: 'var(--text-sec)',
  warning: 'var(--orange)',
};

export const Toast: React.FC<{
  message: string;
  type: ToastType;
  toastKey: number;
}> = ({ message, type, toastKey }) => {
  return (
    <div
      key={toastKey}
      role="status"
      aria-live="polite"
      className="font-display flex items-center justify-center"
      style={{
        minHeight: '28px',
        fontSize: '18px',
        fontWeight: 600,
        textAlign: 'center',
        color: message ? COLOR_MAP[type] : 'transparent',
        transition: 'color 0.2s ease',
        marginTop: '12px',
      }}
    >
      {message || ' '}
    </div>
  );
};
