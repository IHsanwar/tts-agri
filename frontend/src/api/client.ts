import { getCookie } from '../lib/utils';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details: any;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload?.error?.message || 'Terjadi kesalahan pada server.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.error?.code || 'error';
    this.details = payload?.error?.details || {};
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  // Double submit CSRF cookie if method is mutative
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let csrfToken: string | null = null;
    if (url.includes('/teacher/')) {
      csrfToken = getCookie('tts_teacher_csrf');
    } else if (url.includes('/playtest/')) {
      csrfToken = getCookie('tts_playtest_csrf') || getCookie('tts_teacher_csrf');
    } else if (url.includes('/play/') || url.includes('/join')) {
      csrfToken = getCookie('tts_group_csrf');
    } else {
      csrfToken = getCookie('tts_playtest_csrf') || getCookie('tts_group_csrf') || getCookie('tts_teacher_csrf');
    }

    if (csrfToken && !headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let payload: ApiErrorPayload;
    try {
      payload = await response.json();
    } catch {
      payload = {
        error: {
          code: 'network_error',
          message: `Permintaan gagal dengan status ${response.status}`,
        },
      };
    }
    throw new ApiError(response.status, payload);
  }

  // Handle blob/download if needed (like CSV export)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
    return (await response.blob()) as unknown as T;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}

