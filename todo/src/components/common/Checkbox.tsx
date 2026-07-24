import { motion } from 'motion/react';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  accent?: 'lavender' | 'mint';
}

export function Checkbox({ checked, onChange, accent = 'lavender' }: CheckboxProps) {
  const checkedClass =
    accent === 'lavender'
      ? 'border-lavender-400 bg-lavender-400'
      : 'border-mint-400 bg-mint-400';
  const idleClass =
    accent === 'lavender' ? 'border-lavender-200 bg-white' : 'border-mint-200 bg-white';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors after:absolute after:-inset-2.5 after:content-[''] ${
        checked ? checkedClass : idleClass
      }`}
    >
      {checked && (
        <motion.svg
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          viewBox="0 0 12 10"
          className="h-3 w-3 fill-none stroke-white stroke-2"
        >
          <path d="M1 5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      )}
    </button>
  );
}
