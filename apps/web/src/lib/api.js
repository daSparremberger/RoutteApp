import { useAuthStore } from '../stores/auth';
const APP_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:3001';
const MANAGEMENT_BASE = import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000';
async function getToken() {
    return useAuthStore.getState().token;
}
async function req(base, path, opts) {
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
async function uploadFile(base, path, file) {
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
function createClient(base) {
    return {
        get: (path) => req(base, path),
        post: (path, body) => req(base, path, { method: 'POST', body: JSON.stringify(body) }),
        put: (path, body) => req(base, path, { method: 'PUT', body: JSON.stringify(body) }),
        patch: (path, body) => req(base, path, { method: 'PATCH', body: JSON.stringify(body) }),
        delete: (path) => req(base, path, { method: 'DELETE' }),
        upload: (path, file) => uploadFile(base, path, file),
    };
}
export const appApi = createClient(APP_BASE);
export const managementApi = createClient(MANAGEMENT_BASE);
export const api = appApi;
export function resolveUploadUrl(url) {
    if (!url)
        return undefined;
    if (url.startsWith('http'))
        return url;
    return `${APP_BASE}${url}`;
}
export async function downloadCsv(path, filename) {
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
