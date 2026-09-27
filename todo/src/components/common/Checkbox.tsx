import { motion } from 'motion/react';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  accent?: 'lavender' | 'mint';
}

export function Checkbox({ checked, onChange, accent = 'lavender' }: CheckboxProps) {
  const toneClass = accent === 'lavender' ? 'tone-projects' : 'tone-tasks';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`td-check ${toneClass}${checked ? ' is-checked' : ''}`}
    >
      {checked && (
        <motion.svg
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          viewBox="0 0 12 10"
          aria-hidden="true"
        >
          <path d="M1 5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      )}
    </button>
  );
}
