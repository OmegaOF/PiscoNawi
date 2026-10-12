import React from 'react';
import { motion } from 'framer-motion';
import SectionHeader from '../../../components/reports/SectionHeader';
import { usePresentation } from '../../../contexts/PresentationContext';
import { SectionId, sectionMeta } from '../sections';
import { cx } from '../../../lib/cx';

interface SectionWrapProps {
  id: SectionId;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

const SectionWrap: React.FC<SectionWrapProps> = ({ id, subtitle, right, children }) => {
  const { active } = usePresentation();
  const meta = sectionMeta(id);
  return (
    <motion.section
      id={id}
      data-section={id}
      className={cx(
        active ? 'mx-auto flex min-h-screen w-full max-w-[1500px] snap-start flex-col justify-center px-6 py-16 lg:px-12' : 'scroll-mt-44',
      )}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: !active, amount: active ? 0.35 : 0.08 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <SectionHeader index={meta.index} title={meta.label} subtitle={subtitle} icon={meta.icon} right={right} />
      {children}
    </motion.section>
  );
};

export default SectionWrap;
