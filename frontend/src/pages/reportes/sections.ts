import {
  CameraIcon,
  ChartBarIcon,
  ClockIcon,
  IdentificationIcon,
  MapPinIcon,
  PhotoIcon,
  SparklesIcon,
  TableCellsIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

export const SECTIONS = [
  { id: 'resumen', label: 'Resumen ejecutivo', icon: SparklesIcon },
  { id: 'mapa', label: 'Mapa de zonas', icon: MapPinIcon },
  { id: 'evolucion', label: 'Evolución temporal', icon: ChartBarIcon },
  { id: 'horario', label: 'Patrón horario', icon: ClockIcon },
  { id: 'modelo', label: 'Resultado del modelo', icon: BeakerIcon },
  { id: 'galeria', label: 'Capturas críticas', icon: PhotoIcon },
  { id: 'placas', label: 'Placas reincidentes', icon: IdentificationIcon },
  { id: 'operacion', label: 'Dispositivos y operadores', icon: CameraIcon },
  { id: 'tabla', label: 'Resumen por período', icon: TableCellsIcon },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export function sectionMeta(id: SectionId) {
  const i = SECTIONS.findIndex((s) => s.id === id);
  return { ...SECTIONS[i], index: i + 1 };
}
