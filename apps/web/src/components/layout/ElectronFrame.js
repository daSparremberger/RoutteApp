import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Minus, Square, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
const TITLEBAR_HEIGHT = 36;
const dragStyle = { WebkitAppRegion: 'drag' };
const noDragStyle = { WebkitAppRegion: 'no-drag' };
export function ElectronFrame() {
    const [isMaximized, setIsMaximized] = useState(false);
    const [updaterStatus, setUpdaterStatus] = useState(null);
    const isDesktop = Boolean(window.electronAPI?.isDesktop);
    useEffect(() => {
        if (!isDesktop || !window.electronAPI)
            return;
        window.electronAPI.windowIsMaximized().then(setIsMaximized).catch(() => undefined);
        const offMaximized = window.electronAPI.onWindowMaximizedChanged((value) => setIsMaximized(value));
        const offUpdater = window.electronAPI.onUpdaterStatus((payload) => setUpdaterStatus(payload));
        return () => {
            offMaximized?.();
            offUpdater?.();
        };
    }, [isDesktop]);
    const updaterMessage = useMemo(() => {
        if (!updaterStatus)
            return null;
        if (updaterStatus.status === 'checking')
            return 'Verificando atualizações...';
        if (updaterStatus.status === 'available')
            return `Nova versão encontrada (${updaterStatus.version}). Baixando em segundo plano...`;
        if (updaterStatus.status === 'download-progress') {
            const progress = Math.min(100, Math.max(0, Math.round(updaterStatus.progress || 0)));
            return `Baixando atualização: ${progress}%`;
        }
        if (updaterStatus.status === 'downloaded')
            return `Atualização ${updaterStatus.version} pronta para instalar.`;
        if (updaterStatus.status === 'error')
            return updaterStatus.message || 'Falha ao verificar atualizações.';
        return null;
    }, [updaterStatus]);
    if (!isDesktop)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-x-0 top-0 z-[120] flex items-center justify-end border-b border-border bg-surface2/95 px-1 backdrop-blur-sm", style: { height: TITLEBAR_HEIGHT, ...dragStyle }, children: _jsxs("div", { className: "flex items-center gap-1", style: noDragStyle, children: [_jsx("button", { type: "button", onClick: () => window.electronAPI?.windowMinimize(), className: "flex h-7 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text", "aria-label": "Minimizar", title: "Minimizar", children: _jsx(Minus, { size: 14 }) }), _jsx("button", { type: "button", onClick: () => window.electronAPI?.windowMaximizeToggle(), className: "flex h-7 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text", "aria-label": isMaximized ? 'Restaurar' : 'Maximizar', title: isMaximized ? 'Restaurar' : 'Maximizar', children: _jsx(Square, { size: 12 }) }), _jsx("button", { type: "button", onClick: () => window.electronAPI?.windowClose(), className: "flex h-7 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger-muted hover:text-danger", "aria-label": "Fechar", title: "Fechar", children: _jsx(X, { size: 14 }) })] }) }), updaterMessage && (_jsxs("div", { className: "fixed right-3 top-[42px] z-[121] rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text shadow-lg", children: [_jsx("div", { className: "mb-1", children: updaterMessage }), updaterStatus?.status === 'downloaded' && (_jsx("button", { type: "button", className: "ui-btn-primary px-3 py-1 text-xs", onClick: () => window.electronAPI?.installUpdateNow(), children: "Instalar agora" }))] }))] }));
}
