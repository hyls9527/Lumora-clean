/**
 * Filter criteria for advanced image filtering.
 * All fields are optional — only set fields are applied.
 */
export interface FilterCriteria {
  /** Filter by model name (exact match from metadata_json) */
  model?: string;
  /** Minimum rating (0-5) */
  ratingMin?: number;
  /** Maximum rating (0-5) */
  ratingMax?: number;
  /** Only show favorites */
  favorite?: boolean;
  /** Filter by format (png, jpg, webp, avif) */
  format?: string;
  /** Start date (ISO string, inclusive) */
  dateFrom?: string;
  /** End date (ISO string, inclusive) */
  dateTo?: string;
  /** Exact SD seed match (from metadata_json.$.seed) */
  seed?: number;
  /** Exact SD steps match (from metadata_json.$.steps) */
  steps?: number;
  /** CFG scale lower bound (from metadata_json.$.cfg_scale) */
  cfgMin?: number;
  /** CFG scale upper bound (from metadata_json.$.cfg_scale) */
  cfgMax?: number;
  /** Exact sampler name match (from metadata_json.$.sampler) */
  sampler?: string;
}

/**
 * Check if a FilterCriteria has any active filters.
 */
export function hasActiveFilters(criteria: FilterCriteria): boolean {
  return (
    criteria.model !== undefined ||
    criteria.ratingMin !== undefined ||
    criteria.ratingMax !== undefined ||
    criteria.favorite === true ||
    criteria.format !== undefined ||
    criteria.dateFrom !== undefined ||
    criteria.dateTo !== undefined ||
    criteria.seed !== undefined ||
    criteria.steps !== undefined ||
    criteria.cfgMin !== undefined ||
    criteria.cfgMax !== undefined ||
    criteria.sampler !== undefined
  );
}

/**
 * Count the number of active filters.
 */
export function countActiveFilters(criteria: FilterCriteria): number {
  let count = 0;
  if (criteria.model !== undefined) count++;
  if (criteria.ratingMin !== undefined || criteria.ratingMax !== undefined) count++;
  if (criteria.favorite === true) count++;
  if (criteria.format !== undefined) count++;
  if (criteria.dateFrom !== undefined || criteria.dateTo !== undefined) count++;
  if (criteria.seed !== undefined) count++;
  if (criteria.steps !== undefined) count++;
  if (criteria.cfgMin !== undefined || criteria.cfgMax !== undefined) count++;
  if (criteria.sampler !== undefined) count++;
  return count;
}
