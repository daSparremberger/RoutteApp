import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
        if (role === 'motorista')
            return 'Convite aceito. Baixe o aplicativo do motorista (APK).';
        if (role === 'gestor')
            return 'Convite aceito. Baixe o aplicativo desktop do gestor (.exe).';
        return 'Escolha a versão que deseja instalar.';
    }, [role]);
    return (_jsx("div", { className: "app-container items-center justify-center px-4 py-6", children: _jsxs("div", { className: "w-full max-w-3xl rounded-[28px] border border-border bg-surface p-6 shadow-[0_28px_52px_rgba(16,18,20,0.14)] md:p-8", children: [_jsxs("div", { className: "mb-8 text-center", children: [_jsx("h1", { className: "font-heading text-2xl font-bold text-text md:text-3xl", children: "Downloads" }), _jsx("p", { className: "mt-2 text-sm text-text-muted md:text-base", children: recommendation })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("a", { href: APK_URL, target: "_blank", rel: "noopener noreferrer", className: "rounded-2xl border border-border bg-surface2 p-5 transition-all hover:border-success/40 hover:bg-surface", children: [_jsx("div", { className: "mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-success-muted text-success", children: _jsx(Smartphone, { size: 20 }) }), _jsx("h2", { className: "font-heading text-lg font-bold text-text", children: "Motorista - Aplicativo Android (APK)" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Instala\u00E7\u00E3o para o motorista no tablet ou celular Android." }), _jsxs("div", { className: "mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface", children: [_jsx(Download, { size: 16 }), "Baixar APK", _jsx(ExternalLink, { size: 14 })] })] }), _jsxs("a", { href: DESKTOP_URL, target: "_blank", rel: "noopener noreferrer", className: "rounded-2xl border border-border bg-surface2 p-5 transition-all hover:border-success/40 hover:bg-surface", children: [_jsx("div", { className: "mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-muted text-text", children: _jsx(Laptop, { size: 20 }) }), _jsx("h2", { className: "font-heading text-lg font-bold text-text", children: "Gestor - Aplicativo Desktop (.exe)" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Instala\u00E7\u00E3o para opera\u00E7\u00E3o administrativa no Windows." }), _jsxs("div", { className: "mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface", children: [_jsx(Download, { size: 16 }), "Baixar .exe", _jsx(ExternalLink, { size: 14 })] })] })] }), _jsx("p", { className: "mt-6 text-center text-xs text-text-muted", children: "Se os links n\u00E3o estiverem configurados, voc\u00EA ser\u00E1 redirecionado para a p\u00E1gina de releases." })] }) }));
}
