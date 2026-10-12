import React from 'react';
import { PresentationChartLineIcon } from '@heroicons/react/24/outline';
import { usePresentation } from '../../contexts/PresentationContext';

const PresentationToggle: React.FC = () => {
  const { enable } = usePresentation();
  return (
    <button
      type="button"
      onClick={() => {
        enable();
        document.documentElement.requestFullscreen?.().catch(() => undefined);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rojo-tinto px-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
    >
      <PresentationChartLineIcon className="h-4 w-4" /> Modo presentación
    </button>
  );
};

export default PresentationToggle;
