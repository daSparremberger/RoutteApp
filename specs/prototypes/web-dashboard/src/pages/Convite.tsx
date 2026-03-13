import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ConviteInfo {
  tipo: 'gestor' | 'motorista';
  tenant: { id: number; nome: string; cidade?: string };
  email_restrito?: string;
  motorista?: { id: number; nome: string };
}

export function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConviteInfo | null>(null);

  useEffect(() => {
    async function validateConvite() {
      try {
        const res = await fetch(`${API_URL}/auth/convite/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Convite invalido');
        }
        const data = await res.json();
        setConvite(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      validateConvite();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="app-container items-center justify-center">
        <p className="text-text-muted">Validando convite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-8 text-center shadow-[0_28px_52px_rgba(16,18,20,0.14)]">
          <h1 className="mb-4 text-xl font-bold text-danger">Convite Invalido</h1>
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-8 shadow-[0_28px_52px_rgba(16,18,20,0.14)]">
        <h1 className="font-heading mb-2 text-2xl font-bold text-text">Convite Recebido</h1>
        <p className="mb-6 text-text-muted">
          Voce foi convidado para ser{' '}
          <span className="font-medium text-success">
            {convite?.tipo === 'gestor' ? 'Gestor' : 'Motorista'}
          </span>{' '}
          em <span className="font-medium text-text">{convite?.tenant.nome}</span>
          {convite?.tenant.cidade && ` - ${convite.tenant.cidade}`}
        </p>
        {convite?.email_restrito && (
          <p className="mb-4 text-sm text-text-muted">
            Este convite e restrito ao email: {convite.email_restrito}
          </p>
        )}
        <button
          onClick={() => navigate(`/login?convite=${token}`)}
          className="ui-btn-primary w-full py-3"
        >
          Aceitar Convite
        </button>
      </div>
    </div>
  );
}





