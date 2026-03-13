import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 className="font-heading text-xl font-bold text-text md:text-[30px]">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{action}</div>}
    </motion.div>
  );
}



