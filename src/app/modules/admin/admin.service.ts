import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/http/api.service';
import { Items } from '@app/core/models/api.model';
import { User } from '@app/core/models/user.model';
import { Category, CategoryMaterial, CategorySkill, CreateUserRequest } from './admin.models';

/** seefix-api /api/admin/* (ADMIN only). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  users() {
    return this.api.get<Items<User>>('/api/admin/users');
  }

  createUser(body: CreateUserRequest) {
    return this.api.post<{ user: User }>('/api/admin/users', body);
  }

  categories() {
    return this.api.get<Items<Category>>('/api/admin/knowledge/categories');
  }

  /** Only keys present in `changes` are updated. */
  updateCategory(code: string, changes: Partial<Category>) {
    return this.api.patch(`/api/admin/knowledge/categories/${code}`, changes);
  }

  categorySkills(code: string) {
    return this.api.get<Items<CategorySkill>>(`/api/admin/knowledge/categories/${code}/skills`);
  }

  categoryMaterials(code: string) {
    return this.api.get<Items<CategoryMaterial>>(`/api/admin/knowledge/categories/${code}/materials`);
  }

  /** Replaces the category's whole skill list. */
  replaceSkills(code: string, skills: CategorySkill[]) {
    return this.api.put(`/api/admin/knowledge/categories/${code}/skills`, { skills });
  }

  /** Replaces the category's whole material list. */
  replaceMaterials(code: string, materials: CategoryMaterial[]) {
    return this.api.put(`/api/admin/knowledge/categories/${code}/materials`, { materials });
  }
}
