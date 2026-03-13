import { useAuthStore } from '../stores/auth';

const APP_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:3001';
const MANAGEMENT_BASE = import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000';

async function getToken(): Promise<string | null> {
  return useAuthStore.getState().token;
}

async function req<T>(base: string, path: string, opts?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro');
  }
  return res.json();
}

async function uploadFile(base: string, path: string, file: File): Promise<{ url: string; filename: string; size: number }> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro no upload');
  }
  return res.json();
}

function createClient(base: string) {
  return {
    get: <T>(path: string) => req<T>(base, path),
    post: <T>(path: string, body: unknown) => req<T>(base, path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) => req<T>(base, path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) => req<T>(base, path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string) => req<T>(base, path, { method: 'DELETE' }),
    upload: (path: string, file: File) => uploadFile(base, path, file),
  };
}

export const appApi = createClient(APP_BASE);
export const managementApi = createClient(MANAGEMENT_BASE);
export const api = appApi;

export function resolveUploadUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${APP_BASE}${url}`;
}

export async function downloadCsv(path: string, filename: string) {
  const token = await getToken();
  const res = await fetch(`${APP_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro no download');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
