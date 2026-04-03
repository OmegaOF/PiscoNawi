export const ROLE_OPERADOR = 'Usuario final';
export const ROLE_ANALISTA = 'Usuario analista';
export const ROLE_ADMIN = 'Administrador';
export const ROLE_DEV = 'Constructor del sistema';

export type RoleName =
  | typeof ROLE_OPERADOR
  | typeof ROLE_ANALISTA
  | typeof ROLE_ADMIN
  | typeof ROLE_DEV;

export function hasAnyRole(userRoles: string[] | undefined, allowed: string[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return allowed.some((role) => userRoles.includes(role));
}
