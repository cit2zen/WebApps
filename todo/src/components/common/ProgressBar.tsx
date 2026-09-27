import { motion } from 'motion/react';

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="td-progress">
      <div className="td-progress-track">
        <motion.div
          className="td-progress-fill"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="td-progress-num">{percent}%</span>
    </div>
  );
}
