import React from 'react';
import { CheckCircleIcon, FireIcon, MinusIcon } from '@heroicons/react/24/solid';
import { cx } from '../../lib/cx';

interface ClaseBadgeProps {
  clase?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Resultado binario de una detección: con smog / sin smog. */
const ClaseBadge: React.FC<ClaseBadgeProps> = ({ clase, size = 'md', className }) => {
  const esSmog = clase === 'smog';
  const desconocida = clase !== 'smog' && clase !== 'sin_smog';
  const Icon = desconocida ? MinusIcon : esSmog ? FireIcon : CheckCircleIcon;
  const estilo = desconocida
    ? 'bg-smog-sin/20 text-[#5F6368] ring-smog-sin/40'
    : esSmog
      ? 'bg-smog-alto/15 text-smog-alto ring-smog-alto/30'
      : 'bg-smog-bajo/15 text-smog-bajo ring-smog-bajo/30';
  const sz = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : size === 'lg' ? 'text-base px-4 py-1.5 gap-2' : 'text-xs px-2.5 py-1 gap-1.5';
  const iz = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <span className={cx('inline-flex items-center rounded-full font-semibold ring-1 ring-inset whitespace-nowrap', estilo, sz, className)}>
      <Icon className={iz} aria-hidden />
      {desconocida ? 'Sin analizar' : esSmog ? 'Con smog' : 'Sin smog'}
    </span>
  );
};

export default ClaseBadge;
