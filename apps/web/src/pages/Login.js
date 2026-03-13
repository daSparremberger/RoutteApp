import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { Download } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../stores/auth';
import { useModulesStore } from '../stores/modules';
const APP_API_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:3001';
const MANAGEMENT_API_URL = import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000';
const ENABLE_DEV_LOGIN = import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true';
export function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('app');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setAuth = useAuthStore((s) => s.setAuth);
    const setModules = useModulesStore((s) => s.setModules);
    const clearModules = useModulesStore((s) => s.clearModules);
    const conviteToken = searchParams.get('convite');
    const isElectron = window.location.protocol === 'file:' || navigator.userAgent.toLowerCase().includes('electron');
    async function concluirLogin(idToken) {
        const apiBase = mode === 'admin' ? MANAGEMENT_API_URL : APP_API_URL;
        const res = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebase_id_token: idToken })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Erro no login');
        }
        const data = await res.json();
        if (mode === 'admin') {
            clearModules();
            setAuth({
                id: 0,
                tenant_id: null,
                firebase_uid: data.firebase_uid,
                nome: 'Superadmin',
                email: undefined
            }, 'admin', data.token, 'management');
            navigate('/admin');
            return;
        }
        const profileRes = await fetch(`${APP_API_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${data.token}` }
        });
        const profile = await profileRes.json();
        setModules(profile.modules || []);
        setAuth(data.user, data.role, data.token, 'app');
        navigate('/');
    }
    async function handleDevLogin() {
        setLoading(true);
        setError(null);
        try {
            const apiBase = mode === 'admin' ? MANAGEMENT_API_URL : APP_API_URL;
            const endpoint = `${apiBase}/auth/dev-login`;
            const body = mode === 'admin' ? {} : { role: 'gestor' };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erro no login dev');
            }
            const data = await res.json();
            if (mode === 'admin') {
                clearModules();
                setAuth({
                    id: 0,
                    tenant_id: null,
                    firebase_uid: data.firebase_uid,
                    nome: 'Superadmin Dev',
                    email: undefined,
                }, 'admin', data.token, 'management');
                navigate('/admin');
                return;
            }
            const profileRes = await fetch(`${APP_API_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${data.token}` }
            });
            const profile = await profileRes.json();
            setModules(profile.modules || []);
            setAuth(data.user, data.role, data.token, 'app');
            navigate('/');
        }
        catch (err) {
            setError(err.message || 'Erro no login dev');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        if (!isElectron)
            return;
        (async () => {
            try {
                const result = await getRedirectResult(auth);
                if (!result?.user)
                    return;
                setLoading(true);
                const idToken = await result.user.getIdToken();
                await concluirLogin(idToken);
            }
            catch (err) {
                setError(err.message || 'Erro no login');
            }
            finally {
                setLoading(false);
            }
        })();
    }, [isElectron]);
    async function handleGoogleLogin() {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            if (isElectron) {
                await signInWithRedirect(auth, provider);
                return;
            }
            const result = await signInWithPopup(auth, provider);
            const idToken = await result.user.getIdToken();
            await concluirLogin(idToken);
        }
        catch (err) {
            setError(err.message || 'Erro no login');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "app-container items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-md rounded-[28px] border border-border bg-surface p-8 shadow-[0_28px_52px_rgba(16,18,20,0.14)]", children: [_jsx("h1", { className: "font-heading mb-3 text-2xl font-bold text-text md:text-3xl", children: "Entrar na conta" }), _jsx("p", { className: "mb-8 text-sm text-text-muted md:text-base", children: conviteToken
                        ? 'Você foi convidado para acessar o sistema. Faça login com sua conta Google para continuar.'
                        : 'Acesse sua conta para gerenciar o transporte escolar da sua região.' }), error && (_jsx("div", { className: "mb-6 rounded-2xl border border-danger/30 bg-danger-muted px-4 py-3 text-sm text-danger", children: error })), _jsxs("div", { className: "mb-4 flex gap-2", children: [_jsx("button", { type: "button", onClick: () => setMode('app'), className: `rounded-full px-4 py-2 text-sm ${mode === 'app' ? 'bg-accent text-surface' : 'bg-surface2 text-text-muted'}`, children: "Operacao" }), _jsx("button", { type: "button", onClick: () => setMode('admin'), className: `rounded-full px-4 py-2 text-sm ${mode === 'admin' ? 'bg-accent text-surface' : 'bg-surface2 text-text-muted'}`, children: "Admin" })] }), _jsx("button", { onClick: handleGoogleLogin, disabled: loading, className: "flex w-full items-center justify-center gap-3 rounded-full border border-border bg-surface2 px-6 py-4 font-medium text-text transition-all duration-200 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50", children: loading ? (_jsx("div", { className: "h-5 w-5 animate-spin rounded-full border-2 border-text/20 border-t-text" })) : (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", children: [_jsx("path", { fill: "#4285F4", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { fill: "#34A853", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { fill: "#FBBC05", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { fill: "#EA4335", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), _jsx("span", { children: mode === 'admin' ? 'Entrar no admin' : 'Entrar na operacao' })] })) }), ENABLE_DEV_LOGIN && (_jsx("button", { onClick: handleDevLogin, disabled: loading, className: "mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-accent px-6 py-4 font-medium text-surface transition-all duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50", children: "Entrar em modo dev" })), !isElectron && (_jsxs("a", { href: "/downloads", target: "_blank", rel: "noopener noreferrer", className: "mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-colors hover:bg-accent-hover", children: [_jsx(Download, { size: 16 }), "Baixar Aplicativos"] })), _jsx("p", { className: "mt-8 text-center text-xs text-text-muted", children: "Ao continuar, voc\u00EA concorda com os termos de uso do sistema." })] }) }));
}
