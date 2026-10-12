import { Nivel } from './smog';

/**
 * Paleta validada con el validador de dataviz (CVD + contraste):
 *  claro  #A8303F,#1E8F6E,#D08A14,#3A7BC8 sobre #FFFFFF → todo PASS
 *  oscuro #C04454,#1FA89A,#C2820F,#4C8BD6 sobre #1C1517 → todo PASS
 */
export const PALETTE = {
  light: { smog: '#A8303F', sin_smog: '#1E8F6E', sec: '#D08A14', ter: '#3A7BC8' },
  dark: { smog: '#C04454', sin_smog: '#1FA89A', sec: '#C2820F', ter: '#4C8BD6' },
};

export const LEVEL_COLORS: Record<Nivel, { light: string; dark: string }> = {
  alto: { light: '#C0392B', dark: '#E0564A' },
  moderado: { light: '#D98E04', dark: '#E8A532' },
  bajo: { light: '#1E8F6E', dark: '#1FA89A' },
  sin: { light: '#9AA0A6', dark: '#6B6B6B' },
};

/** Rampa secuencial de un solo tono (vino) para mapas de calor. */
export const SEQ_RAMP = {
  light: ['#F7E6E8', '#E8B4BB', '#CF7A87', '#A8303F', '#6E1A26'],
  dark: ['#33202A', '#5E2633', '#93303F', '#CB5A69', '#F2A7B1'],
};

export interface ChartCtx {
  dark: boolean;
  fs: (px: number) => number;
  cls: typeof PALETTE.light;
  lvl: (n: Nivel) => string;
  seq: string[];
  text: string;
  muted: string;
  grid: string;
  surface: string;
}

export function makeChartCtx(dark: boolean): ChartCtx {
  return {
    dark,
    fs: (px: number) => Math.round(px * (dark ? 1.2 : 1)),
    cls: dark ? PALETTE.dark : PALETTE.light,
    lvl: (n: Nivel) => LEVEL_COLORS[n][dark ? 'dark' : 'light'],
    seq: dark ? SEQ_RAMP.dark : SEQ_RAMP.light,
    text: dark ? '#F3EDE7' : '#1E1E1E',
    muted: dark ? '#A89EA0' : '#6B6B6B',
    grid: dark ? '#2C2426' : '#ECE7DE',
    surface: dark ? '#241B1E' : '#FFFFFF',
  };
}
