import { SchemeCompiledRules } from "../engine/types.js";

export interface CatalogueItem {
  scheme_id: string;
  parent_scheme_id?: string | null;
  official_name: string;
  translated_names: unknown;
  level: string;
  scheme_type: string;
  implementing_state?: string | null;
  department_id?: string | null;
  overview: unknown;
  benefits: unknown;
  min_age?: number | null;
  max_age?: number | null;
  min_income?: number | null;
  max_income?: number | null;
  allowed_genders?: unknown;
  states?: unknown;
  district_ids?: unknown;
  benefit_type?: string | null;
  beneficiary_categories?: unknown;
  status: string;
  accepting_applications: string;
  last_verified?: string | null;
  confidence_level?: string | null;
  data_completeness?: string | null;
  translation_status?: unknown;
  is_test?: boolean | null;
}

class RulesCacheService {
  private cache = new Map<string, SchemeCompiledRules>();
  private catalogueCache: CatalogueItem[] | null = null;
  private datasetVersion = "v0";
  private lastLoadedAt: number | null = null;

  getVersion(): string {
    return this.datasetVersion;
  }

  setVersion(version: string): void {
    this.datasetVersion = version;
  }

  getAll(): SchemeCompiledRules[] {
    return Array.from(this.cache.values());
  }

  get(schemeId: string): SchemeCompiledRules | undefined {
    return this.cache.get(schemeId);
  }

  setAll(schemes: SchemeCompiledRules[], version: string): void {
    this.cache.clear();
    for (const s of schemes) {
      this.cache.set(s.scheme_id, s);
    }
    this.datasetVersion = version;
    this.lastLoadedAt = Date.now();
  }

  getCatalogueItems(): CatalogueItem[] | null {
    return this.catalogueCache;
  }

  setCatalogueItems(items: CatalogueItem[]): void {
    this.catalogueCache = items;
  }

  invalidate(): void {
    this.cache.clear();
    this.catalogueCache = null;
    this.datasetVersion = `v_${Date.now()}`;
    this.lastLoadedAt = null;
  }

  isLoaded(): boolean {
    return this.cache.size > 0 && this.lastLoadedAt !== null;
  }
}

export const rulesCache = new RulesCacheService();
