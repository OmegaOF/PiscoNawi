import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon, FireIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import { ResumenPlacas } from '../../lib/placasApi';
import { fmtInt, fmtPct } from '../../lib/format';
import KpiCard from '../../components/reports/KpiCard';

interface Props {
  resumen: ResumenPlacas | null;
  soloSmog: boolean;
  loading: boolean;
}

const ProgresoPlacas: React.FC<Props> = ({ resumen, soloSmog, loading }) => {
  const pct = resumen?.pct_completado ?? 0;
  const sujeto = soloSmog ? 'vehículos con smog' : 'vehículos analizados';
  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-12">
      <div className="rounded-2xl border border-neutral-border bg-white p-5 shadow-sm lg:col-span-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Avance del registro</p>
        {resumen ? (
          <p className="mt-2 text-lg text-text-dark">
            <span className="text-3xl font-extrabold text-vino">{fmtInt(resumen.con_placa)}</span>
            <span className="text-text-muted"> de </span>
            <span className="font-bold">{fmtInt(resumen.total)}</span> {sujeto} ya tienen placa
          </p>
        ) : (
          <div className="skeleton mt-3 h-8 w-3/4 rounded" />
        )}
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-smog-bajo to-[#2BB28B]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">{fmtPct(pct, 1)} completado</p>
      </div>
      <div className="grid grid-cols-3 gap-4 lg:col-span-6">
        <KpiCard label={soloSmog ? 'Con smog' : 'Vehículos'} value={resumen?.total} format="int" icon={FireIcon} loading={loading} accentClass="bg-smog-alto/15 text-smog-alto" />
        <KpiCard label="Con placa" value={resumen?.con_placa} format="int" icon={IdentificationIcon} loading={loading} accentClass="bg-smog-bajo/15 text-smog-bajo" />
        <KpiCard label="Pendientes" value={resumen?.sin_placa} format="int" icon={ClockIcon} loading={loading} accentClass="bg-smog-moderado/15 text-[#A86E00]" />
      </div>
    </div>
  );
};

export default ProgresoPlacas;
