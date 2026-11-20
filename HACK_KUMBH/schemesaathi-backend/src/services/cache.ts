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

export interface SchemeNameMeta {
  official_name: string;
  translated_names: unknown;
  translation_status: unknown;
  confidence_level?: string | null;
  last_verified?: string | null;
  raw?: unknown;
}

class RulesCacheService {
  private cache = new Map<string, SchemeCompiledRules>();
  private catalogueCache: CatalogueItem[] | null = null;
  private namesMap: Map<string, SchemeNameMeta> | null = null;
  private parentMappings: Record<string, string> | null = null;
  private attributeRegistry: unknown = null;
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

  getNamesMap(): Map<string, SchemeNameMeta> | null {
    return this.namesMap;
  }

  setNamesMap(map: Map<string, SchemeNameMeta>): void {
    this.namesMap = map;
  }

  getParentMappings(): Record<string, string> | null {
    return this.parentMappings;
  }

  setParentMappings(mappings: Record<string, string>): void {
    this.parentMappings = mappings;
  }

  getAttributeRegistry<T>(): T | null {
    return this.attributeRegistry as T | null;
  }

  setAttributeRegistry(reg: unknown): void {
    this.attributeRegistry = reg;
  }

  invalidate(): void {
    this.cache.clear();
    this.catalogueCache = null;
    this.namesMap = null;
    this.parentMappings = null;
    this.attributeRegistry = null;
    this.datasetVersion = `v_${Date.now()}`;
    this.lastLoadedAt = null;
  }

  isLoaded(): boolean {
    return this.cache.size > 0 && this.lastLoadedAt !== null;
  }
}

export const rulesCache = new RulesCacheService();
