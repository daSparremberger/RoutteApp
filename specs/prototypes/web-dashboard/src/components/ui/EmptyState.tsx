import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex flex-col items-center justify-center rounded-[24px] border border-border bg-surface2 py-16"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
        <Icon size={28} className="text-text-muted/50" />
      </div>
      <p className="max-w-xs text-center text-text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}



