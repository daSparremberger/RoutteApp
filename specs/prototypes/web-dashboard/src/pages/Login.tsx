import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { Download } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../stores/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const conviteToken = searchParams.get('convite');
  const isElectron = window.location.protocol === 'file:' || navigator.userAgent.toLowerCase().includes('electron');

  async function concluirLogin(idToken: string) {
    if (conviteToken) {
      const res = await fetch(`${API_URL}/auth/convite/${conviteToken}/aceitar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao aceitar convite');
      }
      const data = await res.json();
      setAuth(data.user, data.role, idToken);
      if (data.role === 'motorista') {
        navigate('/downloads?role=motorista');
      } else if (data.role === 'gestor') {
        navigate('/downloads?role=gestor');
      } else {
        navigate('/');
      }
      return;
    }

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro no login');
    }
    const data = await res.json();
    setAuth(data.user, data.role, idToken);
    navigate('/');
  }

  useEffect(() => {
    if (!isElectron) return;

    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) return;
        setLoading(true);
        const idToken = await result.user.getIdToken();
        await concluirLogin(idToken);
      } catch (err: any) {
        setError(err.message || 'Erro no login');
      } finally {
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
    } catch (err: any) {
      setError(err.message || 'Erro no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-8 shadow-[0_28px_52px_rgba(16,18,20,0.14)]">
        <h1 className="font-heading mb-3 text-2xl font-bold text-text md:text-3xl">
          Entrar na conta
        </h1>

        <p className="mb-8 text-sm text-text-muted md:text-base">
          {conviteToken
            ? 'Você foi convidado para acessar o sistema. Faça login com sua conta Google para continuar.'
            : 'Acesse sua conta para gerenciar o transporte escolar da sua região.'
          }
        </p>

        {error && (
          <div className="mb-6 rounded-2xl border border-danger/30 bg-danger-muted px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-surface2 px-6 py-4 font-medium text-text transition-all duration-200 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-text/20 border-t-text" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Entrar com Google</span>
            </>
          )}
        </button>

        {!isElectron && (
          <a
            href="/downloads"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
          >
            <Download size={16} />
            Baixar Aplicativos
          </a>
        )}

        <p className="mt-8 text-center text-xs text-text-muted">
          Ao continuar, você concorda com os termos de uso do sistema.
        </p>
      </div>
    </div>
  );
}





