import React, { useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { registerThemes } from '../../lib/chartTheme';
import { usePresentation } from '../../contexts/PresentationContext';

registerThemes();

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  onEvents?: Record<string, (params: any) => void>;
  className?: string;
  ariaLabel?: string;
}

const EChart: React.FC<EChartProps> = ({ option, height = 320, onEvents, className, ariaLabel }) => {
  const { active } = usePresentation();
  const ref = useRef<ReactECharts>(null);

  useEffect(() => {
    const resize = () => ref.current?.getEchartsInstance().resize();
    document.addEventListener('fullscreenchange', resize);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('fullscreenchange', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div role="img" aria-label={ariaLabel} className={className}>
      <ReactECharts
        key={active ? 'dark' : 'light'}
        ref={ref}
        option={option}
        theme={active ? 'pisconawi-dark' : 'pisconawi'}
        notMerge
        lazyUpdate
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onEvents}
      />
    </div>
  );
};

export default EChart;
