import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { registerThemes } from '../../lib/chartTheme';
import { usePresentation } from '../../contexts/PresentationContext';
import ErrorBoundary from './ErrorBoundary';

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
    const resize = () => {
      const chart = ref.current?.getEchartsInstance();
      if (chart && !chart.isDisposed()) chart.resize();
    };
    document.addEventListener('fullscreenchange', resize);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('fullscreenchange', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Antes de pintar los datos nuevos se baja el estado de puntero del render anterior.
  // Si no, ECharts resuelve el mouse contra una serie que ya fue reemplazada y falla al leerla.
  useLayoutEffect(() => {
    const chart = ref.current?.getEchartsInstance();
    if (!chart || chart.isDisposed()) return;
    try {
      chart.dispatchAction({ type: 'hideTip' });
      chart.dispatchAction({ type: 'downplay' });
    } catch {
      // el gráfico está entre dos renders: no hay estado que limpiar
    }
  }, [option]);

  // Los handlers reciben un dataIndex del render anterior cuando el puntero se mueve
  // justo mientras cambian los datos; se aíslan para que no tumben la página.
  const handlers = useMemo(() => {
    if (!onEvents) return undefined;
    return Object.fromEntries(
      Object.entries(onEvents).map(([evento, fn]) => [
        evento,
        (params: any) => {
          try {
            fn(params);
          } catch {
            // índice obsoleto tras un cambio de datos: se ignora el evento
          }
        },
      ]),
    );
  }, [onEvents]);

  return (
    <div role="img" aria-label={ariaLabel} className={className}>
      <ErrorBoundary minHeight={height} resetKey={option}>
        <ReactECharts
          key={active ? 'dark' : 'light'}
          ref={ref}
          option={option}
          theme={active ? 'pisconawi-dark' : 'pisconawi'}
          notMerge
          style={{ height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onEvents={handlers}
        />
      </ErrorBoundary>
    </div>
  );
};

export default EChart;
