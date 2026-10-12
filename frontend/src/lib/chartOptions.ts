/* eslint-disable @typescript-eslint/no-explicit-any */
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { ChartCtx } from './chartTheme';
import { Agrupar, Bucket, DispositivoItem, HeatCell, ScatterPoint, TendenciaItem, UsuarioItem, ZonaItem } from './reportsApi';
import { DIAS_CORTOS, fmtDate, fmtHora, fmtInt, fmtNum, fmtPct, fmtPeriodo, hexA } from './format';
import { etiquetaZona, nivelSmog } from './smog';

const tip = (rows: string[]) => rows.join('<br/>');
const dot = (c: string) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin-right:6px"></span>`;

// --- Medidor ---------------------------------------------------------------
export function gaugeOption(pct: number, ctx: ChartCtx): EChartsOption {
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '100%',
        center: ['50%', '62%'],
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: ctx.fs(18),
            color: [
              [0.3, ctx.lvl('bajo')],
              [0.6, ctx.lvl('moderado')],
              [1, ctx.lvl('alto')],
            ],
          },
        },
        pointer: { length: '58%', width: ctx.fs(6), itemStyle: { color: ctx.text } },
        anchor: { show: true, size: ctx.fs(14), itemStyle: { color: ctx.text, borderColor: ctx.surface, borderWidth: 3 } },
        axisTick: { distance: -ctx.fs(18), length: 6, lineStyle: { color: ctx.surface, width: 1 } },
        splitLine: { distance: -ctx.fs(18), length: ctx.fs(18), lineStyle: { color: ctx.surface, width: 2 } },
        axisLabel: { distance: ctx.fs(24), color: ctx.muted, fontSize: ctx.fs(11), formatter: (v: number) => (v % 20 === 0 ? `${v}` : '') },
        title: { show: true, offsetCenter: [0, '72%'], color: ctx.muted, fontSize: ctx.fs(12) },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '34%'],
          fontSize: ctx.fs(34),
          fontWeight: 800,
          color: ctx.text,
          formatter: (v: number) => `${fmtNum(v, 1)}%`,
        },
        data: [{ value: Number(pct.toFixed(1)), name: 'vehículos con smog' }],
        animationDuration: 1800,
        animationEasing: 'cubicOut',
      },
    ],
  };
}

// --- Evolución temporal ----------------------------------------------------
export function trendOption(rows: TendenciaItem[], imgRows: TendenciaItem[] | null, agrupar: Agrupar, ctx: ChartCtx, stacked: boolean): EChartsOption {
  const labels = rows.map((r) => fmtPeriodo(r.periodo, agrupar));
  const imgMap = new Map((imgRows || []).map((r) => [r.periodo, r.total]));
  const area = (c: string, a1: number) =>
    new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: hexA(c, a1) },
      { offset: 1, color: hexA(c, 0.02) },
    ]);
  const series: any[] = stacked
    ? [
        { name: 'Con smog', type: 'bar', stack: 't', barMaxWidth: 28, itemStyle: { color: ctx.cls.smog, borderColor: ctx.surface, borderWidth: 1 }, data: rows.map((r) => r.smog) },
        {
          name: 'Sin smog',
          type: 'bar',
          stack: 't',
          barMaxWidth: 28,
          itemStyle: { color: ctx.cls.sin_smog, borderRadius: [4, 4, 0, 0], borderColor: ctx.surface, borderWidth: 1 },
          data: rows.map((r) => r.sin_smog),
        },
      ]
    : [
        {
          name: 'Con smog',
          type: 'line',
          smooth: true,
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2.5, color: ctx.cls.smog },
          itemStyle: { color: ctx.cls.smog },
          areaStyle: { color: area(ctx.cls.smog, 0.45) },
          data: rows.map((r) => r.smog),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: ctx.cls.smog, type: 'solid', width: 1, opacity: 0.6 },
            label: { formatter: (p: any) => `Promedio ${fmtNum(p.value, 1)}`, color: ctx.muted, fontSize: ctx.fs(11), position: 'insideEndTop' },
            data: [{ type: 'average' }],
          },
        },
        {
          name: 'Sin smog',
          type: 'line',
          smooth: true,
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, color: ctx.cls.sin_smog },
          itemStyle: { color: ctx.cls.sin_smog },
          areaStyle: { color: area(ctx.cls.sin_smog, 0.18) },
          data: rows.map((r) => r.sin_smog),
        },
      ];
  if (imgRows) {
    series.push({
      name: 'Imágenes subidas',
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: ctx.cls.ter },
      itemStyle: { color: ctx.cls.ter },
      data: rows.map((r) => imgMap.get(r.periodo) ?? 0),
    });
  }
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: ctx.muted } },
      formatter: (ps: any) => {
        const list = Array.isArray(ps) ? ps : [ps];
        const i = list[0]?.dataIndex ?? 0;
        const r = rows[i];
        const pct = r && r.total ? (r.smog / r.total) * 100 : 0;
        return tip([
          `<b>${labels[i]}</b>`,
          ...list.map((p: any) => `${dot(p.color)}${p.seriesName}: <b>${fmtInt(p.value)}</b>`),
          `Total: <b>${fmtInt(r?.total)}</b> · ${fmtPct(pct)} con smog`,
        ]);
      },
    },
    legend: { top: 0, left: 0 },
    grid: { left: 8, right: 16, top: 40, bottom: rows.length > 12 ? 52 : 16, containLabel: true },
    xAxis: { type: 'category', boundaryGap: stacked, data: labels, axisLabel: { fontSize: ctx.fs(11), hideOverlap: true } },
    yAxis: { type: 'value', minInterval: 1 },
    dataZoom: rows.length > 12 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }] : [],
    series,
    animationDuration: 1200,
  };
}

// --- Calendario ------------------------------------------------------------
export function calendarOption(days: TendenciaItem[], range: [string, string], ctx: ChartCtx): EChartsOption {
  return {
    tooltip: {
      formatter: (p: any) =>
        tip([`<b>${fmtDate(p.value[0])}</b>`, `Con smog: <b>${fmtPct(p.value[1])}</b>`, `Vehículos: ${fmtInt(p.value[2])}`]),
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 160,
      text: ['100 %', '0 %'],
      dimension: 1,
      inRange: { color: ctx.seq },
      textStyle: { color: ctx.muted, fontSize: ctx.fs(11) },
    },
    calendar: {
      top: 28,
      left: 36,
      right: 12,
      bottom: 52,
      range,
      cellSize: ['auto', ctx.fs(16)],
      splitLine: { show: false },
      itemStyle: { borderWidth: 2, borderColor: ctx.surface, color: ctx.dark ? '#2a2023' : '#F4F1EC' },
      dayLabel: { firstDay: 1, nameMap: ['D', 'L', 'M', 'X', 'J', 'V', 'S'], color: ctx.muted, fontSize: ctx.fs(10) },
      monthLabel: { nameMap: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], color: ctx.muted, fontSize: ctx.fs(11) },
      yearLabel: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: days.map((d) => [d.periodo, d.total ? Number(((d.smog / d.total) * 100).toFixed(1)) : 0, d.total]),
      },
    ],
  };
}

// --- Patrón horario --------------------------------------------------------
export function hourHeatmapOption(cells: HeatCell[], ctx: ChartCtx): EChartsOption {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const lookup = new Map(cells.map((c) => [`${c.dia_semana}-${c.hora}`, c]));
  const data: any[] = [];
  for (let d = 0; d < 7; d++) {
    for (const h of hours) {
      const c = lookup.get(`${d}-${h}`);
      data.push({ value: [h, d, c && c.total ? c.pct_smog : '-', c?.total ?? 0] });
    }
  }
  return {
    tooltip: {
      position: 'top',
      formatter: (p: any) => {
        const [h, d, pct, total] = p.value;
        if (!total) return `${DIAS_CORTOS[d]} ${fmtHora(h)}<br/>Sin registros`;
        return tip([`<b>${DIAS_CORTOS[d]} ${fmtHora(h)}</b>`, `Con smog: <b>${fmtPct(pct)}</b>`, `Vehículos: ${fmtInt(total)}`]);
      },
    },
    grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
    xAxis: { type: 'category', data: hours.map((h) => `${h}h`), splitArea: { show: false }, axisLabel: { fontSize: ctx.fs(10), interval: 1 }, axisLine: { show: false } },
    yAxis: { type: 'category', data: DIAS_CORTOS, inverse: true, axisLabel: { fontSize: ctx.fs(11) }, axisLine: { show: false } },
    visualMap: {
      min: 0,
      max: 100,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 180,
      text: ['100 % con smog', '0 %'],
      dimension: 2,
      inRange: { color: ctx.seq },
      textStyle: { color: ctx.muted, fontSize: ctx.fs(11) },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: false },
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: ctx.surface },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,.35)' } },
        animationDelay: (i: number) => i * 3,
      },
    ],
  };
}

// --- Ranking horizontal (zonas / dispositivos) ------------------------------
export interface RankItem { id: number; label: string; pct: number; smog: number; total: number }

export function rankingBarOption(items: RankItem[], ctx: ChartCtx): EChartsOption {
  const sorted = [...items].sort((a, b) => b.pct - a.pct);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const it = sorted[p.dataIndex];
        return tip([`<b>${it.label}</b>`, `Con smog: <b>${fmtPct(it.pct)}</b>`, `${fmtInt(it.smog)} de ${fmtInt(it.total)} vehículos`]);
      },
    },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', fontSize: ctx.fs(10) } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: sorted.map((i) => i.label),
      axisLabel: { fontSize: ctx.fs(12), width: 130, overflow: 'truncate', color: ctx.text },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        barCategoryGap: '30%',
        data: sorted.map((i) => ({ value: i.pct, itemStyle: { color: ctx.lvl(nivelSmog(i.pct, i.smog)), borderRadius: [0, 6, 6, 0] } })),
        label: { show: true, position: 'right', formatter: (p: any) => fmtPct(p.value, 0), fontSize: ctx.fs(12), color: ctx.text, fontWeight: 600 },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: ctx.muted, type: 'solid', width: 1, opacity: 0.5 },
          label: { show: false },
          data: [{ xAxis: 30 }, { xAxis: 60 }],
        },
        animationDelay: (i: number) => i * 80,
      },
    ],
  };
}

export const zonaToRank = (z: ZonaItem): RankItem => ({ id: z.ubicacion_id, label: etiquetaZona(z), pct: z.pct_smog, smog: z.smog, total: z.total });
export const dispToRank = (d: DispositivoItem): RankItem => ({ id: d.dispositivo_id, label: d.nombre_dispositivo, pct: d.pct_smog, smog: d.smog, total: d.total });

// --- Histograma agrupado ----------------------------------------------------
export function histogramGroupedOption(conf: Bucket[], psmog: Bucket[], ctx: ChartCtx): EChartsOption {
  const labels = (conf.length ? conf : psmog).map((b) => b.rango.replace('-', ' – '));
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, left: 0 },
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: ctx.fs(11) } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: 'Confianza',
        type: 'bar',
        barMaxWidth: 26,
        barGap: '12%',
        itemStyle: { color: ctx.cls.ter, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: ctx.fs(10), color: ctx.muted, formatter: (p: any) => (p.value ? fmtInt(p.value) : '') },
        data: conf.map((b) => b.cantidad),
      },
      {
        name: 'Probabilidad de smog (p_smog)',
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: { color: ctx.cls.smog, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: ctx.fs(10), color: ctx.muted, formatter: (p: any) => (p.value ? fmtInt(p.value) : '') },
        data: psmog.map((b) => b.cantidad),
      },
    ],
    animationDelay: (i: number) => i * 60,
  };
}

// --- Separación de clases (histograma fino de p_smog) -----------------------
export function separationOption(points: ScatterPoint[], ctx: ChartCtx): EChartsOption {
  const BINS = 20;
  const smog = new Array(BINS).fill(0);
  const sin = new Array(BINS).fill(0);
  points.forEach((p) => {
    const i = Math.min(BINS - 1, Math.max(0, Math.floor(p.p_smog * BINS)));
    if (p.clase === 'smog') smog[i] += 1;
    else sin[i] += 1;
  });
  const labels = Array.from({ length: BINS }, (_, i) => `${i * 5}–${(i + 1) * 5}%`);
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (ps: any) => {
        const list = Array.isArray(ps) ? ps : [ps];
        const i = list[0]?.dataIndex ?? 0;
        return tip([`<b>p_smog ${labels[i]}</b>`, ...list.filter((p: any) => p.value).map((p: any) => `${dot(p.color)}${p.seriesName}: <b>${fmtInt(p.value)}</b>`)]);
      },
    },
    legend: { top: 0, left: 0 },
    grid: { left: 8, right: 12, top: 36, bottom: 28, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      name: 'Probabilidad de smog asignada por la CNN',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { fontSize: ctx.fs(10), interval: 3, formatter: (_: string, i: number) => `${i * 5}%` },
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: 'Sin smog',
        type: 'bar',
        stack: 'c',
        barCategoryGap: '8%',
        itemStyle: { color: ctx.cls.sin_smog, borderColor: ctx.surface, borderWidth: 1 },
        data: sin,
        markArea: {
          silent: true,
          itemStyle: { color: ctx.dark ? 'rgba(232,165,50,0.10)' : 'rgba(217,142,4,0.10)' },
          label: { show: true, position: 'insideTop', formatter: 'Zona de duda', color: ctx.muted, fontSize: ctx.fs(10) },
          data: [[{ xAxis: labels[9] }, { xAxis: labels[10] }]],
        },
      },
      {
        name: 'Con smog',
        type: 'bar',
        stack: 'c',
        itemStyle: { color: ctx.cls.smog, borderColor: ctx.surface, borderWidth: 1, borderRadius: [3, 3, 0, 0] },
        data: smog,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: ctx.text, type: 'solid', width: 1.5 },
          label: { formatter: 'Umbral 50 %', color: ctx.text, fontSize: ctx.fs(11), position: 'end' },
          data: [{ xAxis: labels[10] }],
        },
      },
    ],
    animationDuration: 900,
  };
}

// --- Operadores --------------------------------------------------------------
export function operatorsOption(users: UsuarioItem[], ctx: ChartCtx): EChartsOption {
  const rows = users.filter((u) => u.total_predicciones > 0).sort((a, b) => b.total_predicciones - a.total_predicciones);
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (ps: any) => {
        const u = rows[ps[0].dataIndex];
        return tip([
          `<b>${u.nombre}</b> (${u.username})`,
          `${dot(ctx.cls.smog)}Con smog: <b>${fmtInt(u.smog ?? 0)}</b>`,
          `${dot(ctx.cls.sin_smog)}Sin smog: <b>${fmtInt(u.sin_smog ?? u.total_predicciones - (u.smog ?? 0))}</b>`,
          `Imágenes subidas: ${fmtInt(u.total_imagenes)}`,
        ]);
      },
    },
    legend: { top: 0, left: 0 },
    grid: { left: 8, right: 56, top: 36, bottom: 8, containLabel: true },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', inverse: true, data: rows.map((u) => u.nombre), axisLabel: { color: ctx.text, width: 160, overflow: 'truncate' }, axisLine: { show: false } },
    series: [
      { name: 'Con smog', type: 'bar', stack: 'u', barMaxWidth: 22, itemStyle: { color: ctx.cls.smog, borderColor: ctx.surface, borderWidth: 1 }, data: rows.map((u) => u.smog ?? 0) },
      {
        name: 'Sin smog',
        type: 'bar',
        stack: 'u',
        barMaxWidth: 22,
        itemStyle: { color: ctx.cls.sin_smog, borderRadius: [0, 6, 6, 0], borderColor: ctx.surface, borderWidth: 1 },
        label: {
          show: true,
          position: 'right',
          color: ctx.text,
          fontSize: ctx.fs(11),
          formatter: (p: any) => fmtPct(rows[p.dataIndex].pct_smog ?? 0, 0),
        },
        data: rows.map((u) => u.sin_smog ?? u.total_predicciones - (u.smog ?? 0)),
      },
    ],
  };
}
