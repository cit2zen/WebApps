import { motion } from 'motion/react';

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-lavender-50">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-lavender-400 to-mint-400"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold text-lavender-500">
        {percent}%
      </span>
    </div>
  );
}
