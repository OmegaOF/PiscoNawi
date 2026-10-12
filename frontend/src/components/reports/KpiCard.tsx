import React from 'react';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import AnimatedNumber from './AnimatedNumber';
import { useSurface } from './surface';
import { fmtInt, fmtNum, fmtPct } from '../../lib/format';
import { cx } from '../../lib/cx';

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  format: 'int' | 'pct' | 'pct01';
  icon: HeroIcon;
  delta?: number | null;
  /** '%' = variación relativa · 'pp' = puntos porcentuales */
  deltaUnit?: '%' | 'pp';
  goodWhen?: 'up' | 'down' | 'neutral';
  hint?: string;
  loading?: boolean;
  accentClass?: string;
}

const FORMATS = {
  int: (n: number) => fmtInt(n),
  pct: (n: number) => fmtPct(n, 1),
  pct01: (n: number) => fmtPct(n * 100, 1),
};

const KpiCard: React.FC<KpiCardProps> = ({ label, value, format, icon: Icon, delta, deltaUnit = '%', goodWhen = 'up', hint, loading, accentClass }) => {
  const s = useSurface();
  const showDelta = delta != null && Number.isFinite(delta);
  const up = (delta ?? 0) > 0;
  const good = goodWhen === 'neutral' ? null : goodWhen === 'up' ? up : !up;
  const deltaColor =
    good == null || delta === 0 ? cx(s.muted, s.subtle) : good ? 'bg-smog-bajo/15 text-smog-bajo' : 'bg-smog-alto/15 text-smog-alto';

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border p-4 shadow-sm', s.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cx('text-xs font-medium uppercase tracking-wide', s.muted)}>{label}</p>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', accentClass || s.chip)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading && value == null ? (
        <div className="skeleton mt-3 h-9 w-24 rounded-lg" />
      ) : (
        <p className={cx('mt-2 text-3xl font-bold leading-none', s.text)} style={{ fontVariantNumeric: 'proportional-nums' }}>
          <AnimatedNumber value={value ?? 0} format={FORMATS[format]} replay={s.dark} />
        </p>
      )}
      <div className="mt-3 flex min-h-[22px] items-center gap-2">
        {showDelta && (
          <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', deltaColor)}>
            {up ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
            {up ? '+' : ''}
            {fmtNum(delta as number, 1)} {deltaUnit === 'pp' ? 'pp' : '%'}
          </span>
        )}
        {hint && <span className={cx('text-xs', s.muted)}>{hint}</span>}
      </div>
    </div>
  );
};

export default KpiCard;
