import { Download, ExternalLink, Laptop, Smartphone } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const FALLBACK_RELEASES_URL = 'https://github.com/daSparremberger/LuminaVan/releases/latest';
const APK_URL = import.meta.env.VITE_DOWNLOAD_APK_URL || FALLBACK_RELEASES_URL;
const DESKTOP_URL = import.meta.env.VITE_DOWNLOAD_DESKTOP_URL || FALLBACK_RELEASES_URL;

export function DownloadsPage() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');

  const recommendation = useMemo(() => {
    if (role === 'motorista') return 'Convite aceito. Baixe o aplicativo do motorista (APK).';
    if (role === 'gestor') return 'Convite aceito. Baixe o aplicativo desktop do gestor (.exe).';
    return 'Escolha a versão que deseja instalar.';
  }, [role]);

  return (
    <div className="app-container items-center justify-center px-4 py-6">
      <div className="w-full max-w-3xl rounded-[28px] border border-border bg-surface p-6 shadow-[0_28px_52px_rgba(16,18,20,0.14)] md:p-8">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-2xl font-bold text-text md:text-3xl">Downloads</h1>
          <p className="mt-2 text-sm text-text-muted md:text-base">{recommendation}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <a
            href={APK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-surface2 p-5 transition-all hover:border-success/40 hover:bg-surface"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-success-muted text-success">
              <Smartphone size={20} />
            </div>
            <h2 className="font-heading text-lg font-bold text-text">Motorista - Aplicativo Android (APK)</h2>
            <p className="mt-1 text-sm text-text-muted">
              Instalação para o motorista no tablet ou celular Android.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface">
              <Download size={16} />
              Baixar APK
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href={DESKTOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-surface2 p-5 transition-all hover:border-success/40 hover:bg-surface"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-muted text-text">
              <Laptop size={20} />
            </div>
            <h2 className="font-heading text-lg font-bold text-text">Gestor - Aplicativo Desktop (.exe)</h2>
            <p className="mt-1 text-sm text-text-muted">Instalação para operação administrativa no Windows.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface">
              <Download size={16} />
              Baixar .exe
              <ExternalLink size={14} />
            </div>
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Se os links não estiverem configurados, você será redirecionado para a página de releases.
        </p>
      </div>
    </div>
  );
}
