import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from 'framer-motion';
export function EmptyState({ icon: Icon, message, action }) {
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.1 }, className: "flex flex-col items-center justify-center rounded-[24px] border border-border bg-surface2 py-16", children: [_jsx("div", { className: "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface", children: _jsx(Icon, { size: 28, className: "text-text-muted/50" }) }), _jsx("p", { className: "max-w-xs text-center text-text-muted", children: message }), action && _jsx("div", { className: "mt-4", children: action })] }));
}
