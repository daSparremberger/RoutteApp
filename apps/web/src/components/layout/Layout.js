import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Sidebar, SidebarContent } from './Sidebar';
import { Header } from './Header';
export function Layout() {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    return (_jsxs("div", { className: "app-container gap-2 p-2 md:gap-4 md:p-4", children: [_jsx(Sidebar, {}), _jsx("div", { className: "flex min-w-0 flex-1 flex-col overflow-hidden", children: _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden rounded-[22px] border border-border bg-surface shadow-[0_30px_60px_rgba(16,18,20,0.07)] md:rounded-[28px]", children: [_jsx(Header, { onOpenMenu: () => setMobileMenuOpen(true) }), _jsx("main", { className: "min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 md:px-6 md:pb-6 md:pt-6", children: _jsx(AnimatePresence, { mode: "wait", children: _jsx("div", { className: "h-full", children: _jsx(Outlet, {}) }, location.pathname) }) })] }) }), _jsx(AnimatePresence, { children: mobileMenuOpen && (_jsxs(_Fragment, { children: [_jsx(motion.button, { type: "button", "aria-label": "Fechar menu", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: () => setMobileMenuOpen(false), className: "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden" }), _jsxs(motion.aside, { initial: { x: -320 }, animate: { x: 0 }, exit: { x: -320 }, transition: { duration: 0.2 }, className: "fixed inset-y-0 left-0 z-50 flex w-[278px] flex-col border-r border-border bg-surface2 md:hidden", children: [_jsx("div", { className: "flex items-center justify-end px-3 pt-3", children: _jsx("button", { type: "button", onClick: () => setMobileMenuOpen(false), className: "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface", "aria-label": "Fechar menu", children: _jsx(X, { size: 16 }) }) }), _jsx(SidebarContent, { mobile: true, onNavigate: () => setMobileMenuOpen(false) })] })] })) })] }));
}
