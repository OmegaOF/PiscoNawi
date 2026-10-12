import React from 'react';
import { useSurface } from './surface';
import { cx } from '../../lib/cx';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

function Segmented<T extends string>({ value, options, onChange, size = 'sm', ariaLabel }: SegmentedProps<T>) {
  const s = useSurface();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('inline-flex rounded-lg p-0.5', s.dark ? 'bg-white/10' : 'bg-neutral-bg border border-neutral-border')}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? s.dark
                  ? 'bg-[#C04454] text-white'
                  : 'bg-white text-rojo-tinto shadow-sm'
                : cx(s.muted, s.dark ? 'hover:text-pres-text' : 'hover:text-text-dark'),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
