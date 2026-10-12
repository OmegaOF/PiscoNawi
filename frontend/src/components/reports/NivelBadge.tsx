import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, FireIcon, MinusIcon } from '@heroicons/react/24/solid';
import { Nivel, NIVEL_DESC, NIVEL_LABEL, nivelSmog } from '../../lib/smog';
import { fmtPct } from '../../lib/format';
import { cx } from '../../lib/cx';

const STYLES: Record<Nivel, string> = {
  alto: 'bg-smog-alto/15 text-smog-alto ring-smog-alto/30',
  moderado: 'bg-smog-moderado/15 text-[#A86E00] ring-smog-moderado/40',
  bajo: 'bg-smog-bajo/15 text-smog-bajo ring-smog-bajo/30',
  sin: 'bg-smog-sin/20 text-[#5F6368] ring-smog-sin/40',
};
const ICONS: Record<Nivel, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  alto: FireIcon,
  moderado: ExclamationTriangleIcon,
  bajo: CheckCircleIcon,
  sin: MinusIcon,
};

interface NivelBadgeProps {
  pct?: number;
  smog?: number | null;
  nivel?: Nivel;
  size?: 'sm' | 'md' | 'lg';
  showPct?: boolean;
  className?: string;
}

const NivelBadge: React.FC<NivelBadgeProps> = ({ pct = 0, smog, nivel, size = 'md', showPct, className }) => {
  const n = nivel ?? nivelSmog(pct, smog);
  const Icon = ICONS[n];
  const sz = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : size === 'lg' ? 'text-base px-4 py-1.5 gap-2' : 'text-xs px-2.5 py-1 gap-1.5';
  const iz = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <span title={NIVEL_DESC[n]} className={cx('inline-flex items-center rounded-full font-semibold ring-1 ring-inset whitespace-nowrap', STYLES[n], sz, className)}>
      <Icon className={iz} aria-hidden />
      {NIVEL_LABEL[n]}
      {showPct && <span className="font-normal opacity-80">· {fmtPct(pct, 0)}</span>}
    </span>
  );
};

export default NivelBadge;
