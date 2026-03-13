import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerItem } from './PageTransition';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  subtitle?: string;
}

export function StatCard({ label, value, icon: Icon, trend, subtitle }: StatCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="rounded-3xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(16,18,20,0.08)]"
    >
      <div className="mb-4 flex items-center gap-3">
        <Icon size={18} strokeWidth={1.5} className="text-text-muted" />
        <span className="text-sm font-medium text-text-muted">{label}</span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-text">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
          )}
        </div>

        {trend && (
          <div
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
              trend.positive ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'
            }`}
          >
            <span>{trend.positive ? '+' : '-'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}



