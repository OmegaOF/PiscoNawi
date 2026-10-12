import React, { useMemo } from 'react';
import { useReportFilters } from '../hooks/useReportFilters';
import { useReportsData } from '../hooks/useReportsData';
import { useSection } from '../hooks/useSection';
import { reportsApi } from '../lib/reportsApi';
import { usePresentation } from '../contexts/PresentationContext';
import FilterBar from '../components/reports/FilterBar';
import PresentationShell from '../components/reports/PresentationShell';
import NivelBadge from '../components/reports/NivelBadge';
import { SECTIONS } from './reportes/sections';
import HeroSection from './reportes/sections/HeroSection';
import MapaSection from './reportes/sections/MapaSection';
import EvolucionSection from './reportes/sections/EvolucionSection';
import PatronHorarioSection from './reportes/sections/PatronHorarioSection';
import ModeloSection from './reportes/sections/ModeloSection';
import GaleriaSection from './reportes/sections/GaleriaSection';
import PlacasSection from './reportes/sections/PlacasSection';
import OperacionSection from './reportes/sections/OperacionSection';
import TablaSection from './reportes/sections/TablaSection';
import { fmtInt } from '../lib/format';

const Reportes: React.FC = () => {
  const { filters, preset, setFilters, applyPreset, rangeLabel } = useReportFilters('6m');
  const { enabled: presentacion } = usePresentation();
  const data = useReportsData(filters, { topLimit: 12 });
  const zonasCat = useSection(reportsApi.zonasCatalogo, 'zonas-catalogo');
  const dispCat = useSection(reportsApi.dispositivos, 'dispositivos-catalogo');

  const exportHref = useMemo(() => {
    const p = new URLSearchParams({ tipo: 'reporte_general', agrupar: filters.agrupar });
    if (filters.desde) p.set('desde', filters.desde);
    if (filters.hasta) p.set('hasta', filters.hasta);
    return `/reportes-generados?${p.toString()}`;
  }, [filters]);

  const props = { data, filters, rangeLabel };
  const sections = (
    <>
      <HeroSection {...props} />
      <MapaSection {...props} />
      <EvolucionSection {...props} />
      <PatronHorarioSection {...props} />
      <ModeloSection {...props} />
      <GaleriaSection {...props} />
      <PlacasSection {...props} />
      <OperacionSection {...props} />
      <TablaSection {...props} />
    </>
  );

  if (presentacion) {
    const k = data.kpis.data;
    return (
      <PresentationShell
        title="Pisco Ñawi IA · Monitoreo de smog vehicular"
        subtitle={k ? `${fmtInt(k.total_predicciones)} vehículos analizados en ${rangeLabel}` : `Resultados de ${rangeLabel}`}
        sections={SECTIONS.map(({ id, label }) => ({ id, label }))}
      >
        {sections}
      </PresentationShell>
    );
  }

  const k = data.kpis.data;
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Pisco Ñawi IA</p>
          <h1 className="text-3xl font-extrabold text-vino sm:text-4xl">Panel de reportes</h1>
          <p className="mt-1 text-sm text-text-muted">
            Detección de smog vehicular en {rangeLabel}
            {k ? ` · ${fmtInt(k.total_predicciones)} vehículos analizados` : ''}
          </p>
        </div>
        {k && k.total_predicciones > 0 && <NivelBadge pct={k.pct_smog} smog={k.total_smog} size="lg" showPct />}
      </header>

      <FilterBar
        filters={filters}
        preset={preset}
        onPreset={applyPreset}
        onChange={setFilters}
        zonas={zonasCat.data || []}
        dispositivos={dispCat.data || []}
        loading={data.anyLoading}
        onReload={data.reloadAll}
        exportHref={exportHref}
      />

      <nav className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Ir a sección">
        {SECTIONS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-text-dark ring-1 ring-neutral-border transition hover:text-rojo-tinto hover:ring-rojo-tinto/40"
          >
            <s.icon className="h-3.5 w-3.5" />
            <span className="text-text-muted">{String(i + 1).padStart(2, '0')}</span> {s.label}
          </a>
        ))}
      </nav>

      <div className="space-y-14 pb-10">{sections}</div>
    </div>
  );
};

export default Reportes;
