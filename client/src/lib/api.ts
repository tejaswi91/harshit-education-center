const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'hec_token';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(isFormData ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined)
    },
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : 'Request failed';
    const details =
      typeof payload === 'object' && payload && 'details' in payload
        ? (payload as { details: unknown }).details
        : undefined;
    if (response.status === 401) setToken(null);
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T,>(path: string, form: FormData, method: 'POST' | 'PATCH' = 'POST') =>
    request<T>(path, { method, body: form }),
  /** Protected files need the auth header, so fetch a blob and save it manually. */
  downloadFile: async (path: string, fallbackName: string) => {
    const token = getToken();
    const response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      let message = 'Download failed';
      try {
        const payload = await response.json();
        if (payload?.error) message = String(payload.error);
      } catch {
        /* response body was not JSON */
      }
      throw new ApiError(response.status, message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fallbackName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
};

export { API_BASE };
