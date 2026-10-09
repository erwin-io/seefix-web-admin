import { Role } from '@app/core/models/user.model';

/** GET /api/admin/knowledge/categories */
export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  defaultUrgency: string | null;
  urgencyGuidance: string | null;
  defaultMinHours: number | null;
  defaultMaxHours: number | null;
  defaultRequiredService: string | null;
  defaultRequiredCapability: string | null;
  safetyGuidance: string | null;
  preferredTrade: string | null;
  requiresMaintenanceReview: boolean;
  isActive: boolean;
  sortOrder: number;
}

export const CATEGORY_FIELDS = [
  'description', 'defaultUrgency', 'urgencyGuidance', 'defaultMinHours', 'defaultMaxHours', 'defaultRequiredService',
  'defaultRequiredCapability', 'safetyGuidance', 'preferredTrade', 'requiresMaintenanceReview', 'isActive', 'sortOrder',
] as const;

/** Row of PUT /categories/:code/skills. `description` is upserted onto the shared Skill. */
export interface CategorySkill {
  code: string;
  name: string;
  description: string | null;
  minimumProficiencyLevel: number | null;
  isRequired: boolean;
  isLeadSkill: boolean;
  notes: string | null;
}

/** Row of PUT /categories/:code/materials. `description`/`unit` are upserted onto the shared Material. */
export interface CategoryMaterial {
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
  defaultQtyMin: number | null;
  defaultQtyMax: number | null;
  isCommon: boolean;
  notes: string | null;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  role: Role;
  password: string;
  username?: string;
  jobTitle?: string;
  departmentOrTrade?: string;
  phone?: string;
  institutionalId?: string;
}
