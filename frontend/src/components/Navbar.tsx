import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { hasAnyRole } from '../lib/rbac';
import { navItems, NavLink } from './navbar/navItems';
import NavDropdown from './navbar/NavDropdown';
import MobileNavAccordion from './navbar/MobileNavAccordion';

const Navbar: React.FC = () => {
  const { logout, user, roles } = useAuth();
  const location = useLocation();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Close everything on route change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleOpen = useCallback((label: string) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setOpenDropdown(label);
  }, []);

  const handleClose = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setOpenDropdown(null), 150);
  }, []);

  const getVisibleChildren = (children: NavLink[]) =>
    children.filter((child) => hasAnyRole(roles, child.roles));

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav ref={navRef} className="bg-rojo-tinto text-white shadow-lg fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center min-h-20 py-3">
          {/* Logo */}
          <div className="flex items-center min-w-0 flex-1">
            <div className="flex min-w-0 items-center lg:flex-shrink-0">
              <img
                src="/vermilion-2.png"
                alt="Logotipo de Pisco Ñawi IA"
                className="w-8 h-8 mr-3"
              />
              <h1 className="truncate text-lg font-bold sm:text-xl">PISCONAWI IA</h1>
            </div>

            {/* Desktop navigation */}
            <div className="hidden lg:block ml-8 min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {navItems.map((item, index) => {
                  if (item.type === 'link') {
                    if (!hasAnyRole(roles, item.roles)) return null;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                          isActive(item.path)
                            ? 'bg-neutral-bg text-rojo-tinto'
                            : 'text-white hover:bg-neutral-bg hover:text-rojo-tinto'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  }

                  const visible = getVisibleChildren(item.children);
                  if (visible.length === 0) return null;

                  return (
                    <NavDropdown
                      key={item.label}
                      label={item.label}
                      children={visible}
                      isOpen={openDropdown === item.label}
                      onOpen={() => handleOpen(item.label)}
                      onClose={handleClose}
                      alignRight={index >= navItems.length - 2}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right side: user info + logout + hamburger */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {user && (
              <span className="hidden xl:inline text-sm">
                Bienvenido, {user.nombre}
              </span>
            )}
            <button
              onClick={logout}
              className="hidden sm:inline-flex bg-neutral-bg text-rojo-tinto px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-80 transition-colors duration-200"
            >
              Cerrar Sesión
            </button>
            <button
              className="lg:hidden p-2 rounded-md hover:bg-white/20 transition-colors"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir o cerrar el menú de navegación"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="lg:hidden bg-rojo-tinto border-t border-neutral-bg"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => {
                if (item.type === 'link') {
                  if (!hasAnyRole(roles, item.roles)) return null;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`block px-3 py-2 rounded-md text-base font-medium ${
                        isActive(item.path)
                          ? 'bg-neutral-bg text-rojo-tinto'
                          : 'text-white hover:bg-neutral-bg hover:text-rojo-tinto'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                }

                const visible = getVisibleChildren(item.children);
                if (visible.length === 0) return null;

                return (
                  <MobileNavAccordion
                    key={item.label}
                    label={item.label}
                    children={visible}
                  />
                );
              })}
              <div className="mt-2 border-t border-white/20 pt-3 sm:hidden">
                {user && <p className="px-3 pb-2 text-sm text-white/80">Bienvenido, {user.nombre}</p>}
                <button
                  onClick={logout}
                  className="w-full rounded-md bg-neutral-bg px-3 py-2 text-left text-base font-medium text-rojo-tinto"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
