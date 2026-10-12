import React, { useRef } from 'react';
import { ArrowsPointingOutIcon, ArrowPathIcon, ExclamationTriangleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import HelpPopover from './HelpPopover';
import { useSurface } from './surface';
import { useFullscreen } from '../../hooks/useFullscreen';
import { cx } from '../../lib/cx';

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export interface ChartCardProps {
  title: string;
  subtitle?: React.ReactNode;
  help?: React.ReactNode;
  icon?: HeroIcon;
  loading?: boolean;
  hasData?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  minHeight?: number;
  allowFullscreen?: boolean;
  children?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  help,
  icon: Icon,
  loading,
  hasData = true,
  error,
  empty,
  emptyText = 'No hay datos para el rango seleccionado.',
  onRetry,
  actions,
  className,
  bodyClassName,
  minHeight = 260,
  allowFullscreen = true,
  children,
}) => {
  const s = useSurface();
  const ref = useRef<HTMLDivElement>(null);
  const fs = useFullscreen();
  const firstLoad = loading && !hasData;

  let body: React.ReactNode;
  if (error && !hasData) {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight }}>
        <ExclamationTriangleIcon className="h-8 w-8 text-smog-alto" />
        <p className={cx('text-sm', s.muted)}>{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-rojo-tinto px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            <ArrowPathIcon className="h-4 w-4" /> Reintentar
          </button>
        )}
      </div>
    );
  } else if (firstLoad) {
    body = <div className="skeleton w-full rounded-xl" style={{ height: minHeight }} />;
  } else if (empty) {
    body = (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ minHeight }}>
        <ChartBarIcon className={cx('h-8 w-8', s.muted)} />
        <p className={cx('text-sm', s.muted)}>{emptyText}</p>
      </div>
    );
  } else {
    body = (
      <div className={cx('transition-opacity duration-300', loading ? 'opacity-50' : 'opacity-100')}>{children}</div>
    );
  }

  return (
    <div ref={ref} className={cx('chart-card rounded-2xl border shadow-sm', s.card, className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Icon && (
            <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', s.chip)}>
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className={cx('font-semibold leading-tight', s.text)}>{title}</h3>
            {subtitle && <p className={cx('mt-0.5 text-xs', s.muted)}>{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:order-last">
          {help && <HelpPopover>{help}</HelpPopover>}
          {allowFullscreen && (
            <button
              type="button"
              onClick={() => fs.toggle(ref.current)}
              className={cx('rounded-full p-1', s.muted, s.hover)}
              aria-label="Ver en pantalla completa"
              title="Pantalla completa"
            >
              <ArrowsPointingOutIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{actions}</div>}
      </div>
      <div className={cx('px-4 pb-4 pt-3 sm:px-5 sm:pb-5', bodyClassName)}>{body}</div>
    </div>
  );
};

export default ChartCard;
