import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { NavLink } from './navItems';

interface NavDropdownProps {
  label: string;
  children: NavLink[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  alignRight?: boolean;
}

const NavDropdown: React.FC<NavDropdownProps> = ({
  label,
  children,
  isOpen,
  onOpen,
  onClose,
  alignRight = false,
}) => {
  const location = useLocation();
  const isGroupActive = children.some((child) => location.pathname === child.path);

  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`flex items-center gap-1 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
          isGroupActive
            ? 'bg-white/20 text-white'
            : 'text-white hover:bg-neutral-bg hover:text-rojo-tinto'
        }`}
      >
        {label}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className={`absolute top-full mt-1 min-w-[220px] bg-white text-text-dark shadow-lg rounded-md py-1 z-50 ${
              alignRight ? 'right-0' : 'left-0'
            }`}
          >
            {children.map((child) => {
              const isActive = location.pathname === child.path;
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  role="menuitem"
                  className={`block px-4 py-2 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-rojo-tinto/10 text-rojo-tinto font-semibold'
                      : 'hover:bg-neutral-bg'
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NavDropdown;
