import type React from 'react';
import {
  ArrowTrendingUpIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  MapPinIcon,
  ScaleIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

type HeroIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type TipoReporte = 'reporte_general' | 'cambios_tiempo' | 'comparacion' | 'por_zonas' | 'detallado';

export interface ReportTypeMeta {
  id: TipoReporte;
  titulo: string;
  descripcion: string;
  icon: HeroIcon;
  usaAgrupar: boolean;
  incluye: string[];
}

export const REPORT_TYPES: ReportTypeMeta[] = [
  {
    id: 'reporte_general',
    titulo: 'Reporte general',
    descripcion: 'Indicadores, evolución, mapa de zonas y resumen por período en un solo documento.',
    icon: DocumentChartBarIcon,
    usaAgrupar: true,
    incluye: ['Indicadores', 'Gráfico', 'Mapa', 'Tabla'],
  },
  {
    id: 'cambios_tiempo',
    titulo: 'Cambios en el tiempo',
    descripcion: 'Evolución de vehículos con y sin smog por día, semana o mes.',
    icon: ArrowTrendingUpIcon,
    usaAgrupar: true,
    incluye: ['Gráfico de barras', 'Tabla'],
  },
  {
    id: 'comparacion',
    titulo: 'Comparación smog / sin smog',
    descripcion: 'Distribución de las clases predichas por el modelo en el período.',
    icon: ScaleIcon,
    usaAgrupar: false,
    incluye: ['Gráfico comparativo', 'Tabla'],
  },
  {
    id: 'por_zonas',
    titulo: 'Reporte por zonas',
    descripcion: 'Mapa y ranking de ubicaciones según el porcentaje de smog.',
    icon: MapPinIcon,
    usaAgrupar: false,
    incluye: ['Mapa', 'Ranking', 'Tabla'],
  },
  {
    id: 'detallado',
    titulo: 'Reporte detallado por período',
    descripcion: 'Tabla completa por período con confianza y probabilidad de smog promedio.',
    icon: TableCellsIcon,
    usaAgrupar: true,
    incluye: ['Tabla detallada', 'Conclusión'],
  },
];

export function typeMeta(id?: string | null): ReportTypeMeta | undefined {
  return REPORT_TYPES.find((t) => t.id === id);
}

export const FALLBACK_ICON = DocumentTextIcon;

export const AGRUPAR_LABEL: Record<string, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };
