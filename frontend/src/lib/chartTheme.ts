import * as echarts from 'echarts';
import { PALETTE } from './chartCtx';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

function makeTheme(dark: boolean) {
  const p = dark ? PALETTE.dark : PALETTE.light;
  const text = dark ? '#F3EDE7' : '#1E1E1E';
  const muted = dark ? '#A89EA0' : '#6B6B6B';
  const grid = dark ? '#2C2426' : '#ECE7DE';
  const axis = dark ? '#3A2A2E' : '#D9D2C5';
  const axisCommon = {
    axisLine: { show: true, lineStyle: { color: axis } },
    axisTick: { show: false },
    axisLabel: { color: muted },
    splitLine: { show: true, lineStyle: { color: grid, type: 'solid', width: 1 } },
    nameTextStyle: { color: muted },
  };
  return {
    color: [p.smog, p.sin_smog, p.sec, p.ter],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONT, color: text },
    title: { textStyle: { color: text, fontWeight: 700 }, subtextStyle: { color: muted } },
    legend: { textStyle: { color: muted }, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
    tooltip: {
      backgroundColor: dark ? '#F3EDE7' : '#1E1E1E',
      borderWidth: 0,
      textStyle: { color: dark ? '#1E1E1E' : '#FFFFFF', fontSize: 12 },
      extraCssText: 'border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);padding:8px 12px;',
    },
    categoryAxis: { ...axisCommon, splitLine: { show: false } },
    valueAxis: { ...axisCommon, axisLine: { show: false } },
    dataZoom: {
      borderColor: 'transparent',
      fillerColor: dark ? 'rgba(192,68,84,0.18)' : 'rgba(168,48,63,0.12)',
      handleStyle: { color: p.smog, borderColor: p.smog },
      textStyle: { color: muted },
      dataBackground: { lineStyle: { color: axis }, areaStyle: { color: grid } },
    },
    visualMap: { textStyle: { color: muted } },
  };
}

let registered = false;
export function registerThemes(): void {
  if (registered) return;
  echarts.registerTheme('pisconawi', makeTheme(false));
  echarts.registerTheme('pisconawi-dark', makeTheme(true));
  registered = true;
}


export { PALETTE, LEVEL_COLORS, SEQ_RAMP, makeChartCtx } from './chartCtx';
export type { ChartCtx } from './chartCtx';
