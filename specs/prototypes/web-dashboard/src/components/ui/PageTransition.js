import { jsx as _jsx } from "react/jsx-runtime";
import { motion } from 'framer-motion';
const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
    exit: {
        opacity: 0,
        y: -10,
        transition: {
            duration: 0.2,
        },
    },
};
export function PageTransition({ children, className = '' }) {
    return (_jsx(motion.div, { variants: pageVariants, initial: "initial", animate: "animate", exit: "exit", className: className, children: children }));
}
// Stagger container for child animations
export const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.05,
        },
    },
};
export const staggerItem = {
    initial: { opacity: 0, y: 20 },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
};
