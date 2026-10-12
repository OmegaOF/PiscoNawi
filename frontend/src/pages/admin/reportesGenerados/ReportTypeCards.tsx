import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { REPORT_TYPES, TipoReporte } from './reportTypes';
import { cx } from '../../../lib/cx';

interface Props {
  value: TipoReporte;
  onChange: (t: TipoReporte) => void;
}

const ReportTypeCards: React.FC<Props> = ({ value, onChange }) => {
  const onKey = (e: React.KeyboardEvent) => {
    const i = REPORT_TYPES.findIndex((t) => t.id === value);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(REPORT_TYPES[(i + 1) % REPORT_TYPES.length].id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(REPORT_TYPES[(i - 1 + REPORT_TYPES.length) % REPORT_TYPES.length].id);
    }
  };
  return (
    <div role="radiogroup" aria-label="Tipo de reporte" className="grid gap-2.5" onKeyDown={onKey}>
      {REPORT_TYPES.map((t) => {
        const sel = t.id === value;
        return (
          <motion.button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(t.id)}
            className={cx(
              'relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
              sel ? 'border-vino bg-beige shadow-sm ring-2 ring-vino/70' : 'border-neutral-border bg-white hover:border-vino/40 hover:shadow-sm',
            )}
          >
            <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', sel ? 'bg-vino text-white' : 'bg-vino/10 text-vino')}>
              <t.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text-dark">{t.titulo}</span>
              <span className="mt-0.5 block text-xs leading-snug text-text-muted">{t.descripcion}</span>
              <span className="mt-2 flex flex-wrap gap-1">
                {t.incluye.map((x) => (
                  <span key={x} className="rounded-full bg-neutral-bg px-2 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-neutral-border">
                    {x}
                  </span>
                ))}
              </span>
            </span>
            {sel && <CheckCircleIcon className="absolute right-3 top-3 h-5 w-5 text-vino" />}
          </motion.button>
        );
      })}
    </div>
  );
};

export default ReportTypeCards;
