import {
  RoleName,
  ROLE_OPERADOR,
  ROLE_ANALISTA,
  ROLE_ADMIN,
  ROLE_DEV,
} from '../../lib/rbac';

export interface NavLink {
  path: string;
  label: string;
  roles: RoleName[];
}

export interface NavDirectLink {
  type: 'link';
  path: string;
  label: string;
  roles: RoleName[];
}

export interface NavGroup {
  type: 'group';
  label: string;
  children: NavLink[];
}

export type NavItem = NavDirectLink | NavGroup;

const ALL_ROLES: RoleName[] = [ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV];

export const navItems: NavItem[] = [
  {
    type: 'link',
    label: 'Inicio',
    path: '/dashboard',
    roles: ALL_ROLES,
  },
  {
    type: 'group',
    label: 'Capturas & Análisis',
    children: [
      { path: '/captura', label: 'Captura de Vehículos', roles: ALL_ROLES },
      { path: '/procesar-capturas', label: 'Procesar Capturas (CNN)', roles: ALL_ROLES },
      { path: '/analisis', label: 'Resultados CNN', roles: ALL_ROLES },
      { path: '/analisis-masivo', label: 'Análisis Masivo', roles: ALL_ROLES },
    ],
  },
  {
    type: 'group',
    label: 'Reportes',
    children: [
      { path: '/reportes', label: 'Generar Reportes', roles: [ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV] },
      { path: '/reportes-generados', label: 'Reportes PDF', roles: [ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV] },
    ],
  },
  {
    type: 'group',
    label: 'Gestión del Sistema',
    children: [
      { path: '/catalogos', label: 'Catálogos', roles: ALL_ROLES },
      { path: '/dispositivos', label: 'Dispositivos', roles: ALL_ROLES },
      { path: '/usuarios', label: 'Usuarios', roles: [ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV] },
      { path: '/roles', label: 'Roles', roles: [ROLE_ADMIN, ROLE_DEV] },
      { path: '/configuraciones', label: 'Configuraciones', roles: [ROLE_ADMIN, ROLE_DEV] },
    ],
  },
  {
    type: 'group',
    label: 'Usuario',
    children: [
      { path: '/mi-historial', label: 'Mi Historial', roles: [ROLE_OPERADOR, ROLE_ADMIN, ROLE_DEV] },
      { path: '/perfil', label: 'Mi Perfil', roles: ALL_ROLES },
    ],
  },
];
