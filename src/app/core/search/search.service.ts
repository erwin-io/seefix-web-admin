import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';

/** Server rules (seefix-api `GET /api/search`): 2–100 characters after trimming. */
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;

export interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  /** Web-admin path the caller may open; `null` when the item has no detail page (buildings). */
  route: string | null;
}

export interface SearchGroup {
  type: string;
  label: string;
  items: SearchItem[];
}

export interface SearchResponse {
  q: string;
  groups: SearchGroup[];
}

/** Spotlight search. Role scoping is done by the API; the client only mirrors the length rule. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(ApiService);

  /** `q` goes out as a query parameter (URL-encoded by HttpParams), never interpolated into the path. */
  search(q: string, limit = 5): Observable<SearchResponse> {
    return this.api.get<SearchResponse>('/api/search', { q: q.trim(), limit });
  }
}

/** Searchable once trimmed to the server's 2–100 characters. */
export function searchable(q: string): boolean {
  const t = q.trim();
  return t.length >= SEARCH_MIN && t.length <= SEARCH_MAX;
}

/** Only in-app absolute paths: no protocol-relative `//host`, no `javascript:`/`http:` schemes. */
export function safeRoute(route: string | null | undefined): string | null {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//') || route.includes('\\')) return null;
  return route;
}
