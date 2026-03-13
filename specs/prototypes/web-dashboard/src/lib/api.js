import { useAuthStore } from '../stores/auth';
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
async function getToken() {
    return useAuthStore.getState().token;
}
async function req(path, opts) {
    const token = await getToken();
    const res = await fetch(`${BASE}${path}`, {
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
export const api = {
    get: (path) => req(path),
    post: (path, body) => req(path, { method: 'POST', body: JSON.stringify(body) }),
    put: (path, body) => req(path, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (path) => req(path, { method: 'DELETE' }),
};
