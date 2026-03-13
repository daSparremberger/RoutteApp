import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from 'framer-motion';
export function PageHeader({ title, subtitle, action }) {
    return (_jsxs(motion.div, { initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, className: "mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-heading text-xl font-bold text-text md:text-[30px]", children: title }), subtitle && (_jsx("p", { className: "mt-1 text-sm text-text-muted", children: subtitle }))] }), action && _jsx("div", { className: "flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end", children: action })] }));
}
