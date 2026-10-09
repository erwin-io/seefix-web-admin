export type Role = 'REPORTER' | 'MAINTENANCE_STAFF' | 'MAINTENANCE_SUPERVISOR' | 'PROCUREMENT' | 'WORKER' | 'ADMIN';

export const STAFF_ROLES: Role[] = ['ADMIN', 'MAINTENANCE_STAFF', 'MAINTENANCE_SUPERVISOR', 'PROCUREMENT', 'WORKER'];

/** Role groups mirroring seefix-api `requireRoles(...)`. The server stays authoritative. */
export const MAINTENANCE: Role[] = ['MAINTENANCE_STAFF', 'MAINTENANCE_SUPERVISOR', 'ADMIN'];
export const SUPERVISOR: Role[] = ['MAINTENANCE_SUPERVISOR', 'ADMIN'];
export const PROCUREMENT_ACTORS: Role[] = ['PROCUREMENT', 'ADMIN'];
export const PROCUREMENT_READERS: Role[] = ['PROCUREMENT', ...MAINTENANCE];
export const WORK_ROLES: Role[] = [...MAINTENANCE, 'WORKER'];

export const ROLE_LABEL: Record<Role, string> = {
  REPORTER: 'Reporter',
  MAINTENANCE_STAFF: 'Maintenance Staff',
  MAINTENANCE_SUPERVISOR: 'Maintenance Supervisor',
  PROCUREMENT: 'Procurement',
  WORKER: 'Worker',
  ADMIN: 'Admin',
};

/** `publicUser` from /api/auth and /api/admin/users (camelCase). */
export interface User {
  id: string;
  institutionalId: string | null;
  fullName: string;
  username: string | null;
  email: string;
  role: Role;
  jobTitle: string | null;
  departmentOrTrade: string | null;
  phone: string | null;
  isActive: boolean;
  emailVerified?: boolean;
  emailVerificationRequired?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}
