import React from 'react';
import { useSurface } from './surface';
import { cx } from '../../lib/cx';

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface SectionHeaderProps {
  index: number;
  title: string;
  subtitle?: string;
  icon: HeroIcon;
  right?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ index, title, subtitle, icon: Icon, right }) => {
  const s = useSurface();
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm', s.dark ? 'bg-[#C04454]' : 'bg-rojo-tinto')}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className={cx('text-[11px] font-semibold uppercase tracking-[0.18em]', s.muted)}>Sección {String(index).padStart(2, '0')}</p>
          <h2 className={cx('text-xl font-bold leading-tight sm:text-2xl', s.title)}>{title}</h2>
          {subtitle && <p className={cx('text-sm', s.muted)}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
};

export default SectionHeader;
