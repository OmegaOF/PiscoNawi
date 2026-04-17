import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { NavLink } from './navItems';

interface MobileNavAccordionProps {
  label: string;
  children: NavLink[];
}

const MobileNavAccordion: React.FC<MobileNavAccordionProps> = ({ label, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const isGroupActive = children.some((child) => location.pathname === child.path);

  return (
    <div>
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium ${
          isGroupActive ? 'bg-white/20 text-white' : 'text-white'
        }`}
      >
        {label}
        <ChevronDownIcon
          className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pl-4 space-y-1 pb-1">
              {children.map((child) => {
                const isActive = location.pathname === child.path;
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    className={`block px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-neutral-bg text-rojo-tinto'
                        : 'text-white/90 hover:bg-neutral-bg hover:text-rojo-tinto'
                    }`}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileNavAccordion;
