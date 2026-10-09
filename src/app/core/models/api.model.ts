/** Standard list envelope returned by seefix-api. */
export interface Items<T> {
  items: T[];
}

/**
 * Raw PascalCase DB row. Detail endpoints return `SELECT *`, so these are kept
 * loose on purpose; list endpoints use typed camelCase models per module.
 */
export type Row = Record<string, any>;
