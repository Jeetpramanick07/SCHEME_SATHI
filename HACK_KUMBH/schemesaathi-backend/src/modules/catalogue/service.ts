import crypto from "crypto";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { rulesCache, CatalogueItem } from "../../services/cache.js";
import { SchemeQueryParams } from "./schema.js";

export function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

export interface LocalizedScheme {
  display_name: string;
  simple_explanation: string;
  display_name_fallback: boolean;
  explanation_fallback: boolean;
  lang_fallback: boolean;
  lang_served: "en" | "hi" | "mr";
}

export function localize(
  scheme: {
    official_name: string;
    translated_names?: unknown;
    overview?: unknown;
    translation_status?: unknown;
  },
  lang: "en" | "hi" | "mr" = "en"
): LocalizedScheme {
  const trans = typeof scheme.translated_names === "string"
    ? JSON.parse(scheme.translated_names)
    : (scheme.translated_names as { en?: string; hi?: string; mr?: string } | undefined);
  const ov = typeof scheme.overview === "string"
    ? JSON.parse(scheme.overview)
    : (scheme.overview as { objective?: string; simple_explanation?: { en?: string; hi?: string; mr?: string } } | undefined);
  const transStatus = typeof scheme.translation_status === "string"
    ? JSON.parse(scheme.translation_status)
    : (scheme.translation_status as Record<string, { en?: string; hi?: string; mr?: string }> | undefined);

  let displayName = scheme.official_name;
  let displayExpl = ov?.simple_explanation?.en || "";
  let displayNameFallback = false;
  let explanationFallback = false;

  if (lang === "en") {
    displayName = trans?.en || scheme.official_name;
    displayExpl = ov?.simple_explanation?.en || "";
    displayNameFallback = false;
    explanationFallback = false;
  } else if (lang === "mr") {
    const mrNameStatus = transStatus?.official_name?.mr;
    if (trans?.mr && trans.mr.trim().length > 0 && mrNameStatus !== "placeholder" && mrNameStatus !== "missing") {
      displayName = trans.mr;
      displayNameFallback = false;
    } else {
      displayName = scheme.official_name;
      displayNameFallback = true;
    }

    const mrExpl = ov?.simple_explanation?.mr;
    const mrExplStatus = transStatus?.simple_explanation?.mr;
    if (mrExpl && mrExpl.trim().length > 0 && mrExplStatus !== "placeholder" && mrExplStatus !== "missing") {
      displayExpl = mrExpl;
      explanationFallback = false;
    } else {
      displayExpl = ov?.simple_explanation?.en || "";
      explanationFallback = true;
    }
  } else if (lang === "hi") {
    const hiNameStatus = transStatus?.official_name?.hi;
    if (trans?.hi && trans.hi.trim().length > 0 && hiNameStatus !== "placeholder" && hiNameStatus !== "missing") {
      displayName = trans.hi;
      displayNameFallback = false;
    } else {
      displayName = scheme.official_name;
      displayNameFallback = true;
    }

    const hiExpl = ov?.simple_explanation?.hi;
    const hiExplStatus = transStatus?.simple_explanation?.hi;
    if (hiExpl && hiExpl.trim().length > 0 && hiExplStatus !== "placeholder" && hiExplStatus !== "missing") {
      displayExpl = hiExpl;
      explanationFallback = false;
    } else {
      displayExpl = ov?.simple_explanation?.en || "";
      explanationFallback = true;
    }
  }

  const langFallback = displayNameFallback || explanationFallback;
  const langServed = displayNameFallback && explanationFallback ? "en" : lang;

  return {
    display_name: displayName,
    simple_explanation: displayExpl,
    display_name_fallback: displayNameFallback,
    explanation_fallback: explanationFallback,
    lang_fallback: langFallback,
    lang_served: langServed,
  };
}

export class CatalogueService {
  static localize = localize;
  /**
   * Generates a strong ETag based on dataset version and query params.
   */
  static generateETag(key: string): string {
    const version = rulesCache.getVersion();
    return `"${crypto.createHash("sha256").update(`${version}:${key}`).digest("hex").substring(0, 16)}"`;
  }

  /**
   * Loads search catalogue items with projection to avoid heavy JSON columns.
   */
  static async getCatalogueDataset(): Promise<CatalogueItem[]> {
    const cached = rulesCache.getCatalogueItems();
    if (cached) return cached;

    // Load only lightweight indexed search columns (exclude raw and compiled_rules)
    const rows = await db
      .select({
        scheme_id: schema.schemes.scheme_id,
        parent_scheme_id: schema.schemes.parent_scheme_id,
        official_name: schema.schemes.official_name,
        translated_names: schema.schemes.translated_names,
        level: schema.schemes.level,
        scheme_type: schema.schemes.scheme_type,
        implementing_state: schema.schemes.implementing_state,
        department_id: schema.schemes.department_id,
        overview: schema.schemes.overview,
        benefits: schema.schemes.benefits,
        min_age: schema.schemes.min_age,
        max_age: schema.schemes.max_age,
        min_income: schema.schemes.min_income,
        max_income: schema.schemes.max_income,
        allowed_genders: schema.schemes.allowed_genders,
        states: schema.schemes.states,
        district_ids: schema.schemes.district_ids,
        benefit_type: schema.schemes.benefit_type,
        beneficiary_categories: schema.schemes.beneficiary_categories,
        status: schema.schemes.status,
        accepting_applications: schema.schemes.accepting_applications,
        last_verified: schema.schemes.last_verified,
        confidence_level: schema.schemes.confidence_level,
        data_completeness: schema.schemes.data_completeness,
        translation_status: schema.schemes.translation_status,
        is_test: schema.schemes.is_test,
      })
      .from(schema.schemes);

    rulesCache.setCatalogueItems(rows);
    return rows;
  }

  /**
   * Database-backed full-text and trigram catalogue search (runs directly against PostgreSQL).
   */
  static async searchSchemesDb(params: SchemeQueryParams) {
    const lang = params.lang || "en";
    const limit = params.limit || 20;

    let offset = 0;
    if (params.cursor) {
      try {
        const decoded = Buffer.from(params.cursor, "base64").toString("utf8");
        offset = parseInt(decoded, 10) || 0;
      } catch {
        offset = 0;
      }
    }

    const conditions: SQL[] = [];

    if (!params.include_test) {
      conditions.push(sql`is_test = false`);
    }

    if (params.status) {
      conditions.push(sql`UPPER(status) = UPPER(${params.status})`);
    }

    if (params.level) {
      conditions.push(sql`UPPER(level) = UPPER(${params.level})`);
    }

    if (params.department) {
      conditions.push(sql`UPPER(department_id) = UPPER(${params.department})`);
    }

    if (params.benefit_type) {
      conditions.push(sql`UPPER(benefit_type) = UPPER(${params.benefit_type})`);
    }

    if (params.accepting_applications) {
      conditions.push(sql`UPPER(accepting_applications) = UPPER(${params.accepting_applications})`);
    }

    if (params.q && params.q.trim().length > 0) {
      const rawQ = params.q.trim();
      const likePattern = `%${escapeLike(rawQ)}%`;
      conditions.push(sql`(
        to_tsvector('simple',
          coalesce(official_name, '') || ' ' ||
          coalesce(translated_names->>'en', '') || ' ' ||
          coalesce(translated_names->>'hi', '') || ' ' ||
          coalesce(translated_names->>'mr', '') || ' ' ||
          coalesce(overview->>'objective', '') || ' ' ||
          coalesce(overview->'simple_explanation'->>'en', '') || ' ' ||
          coalesce(overview->'simple_explanation'->>'hi', '') || ' ' ||
          coalesce(overview->'simple_explanation'->>'mr', '')
        ) @@ plainto_tsquery('simple', ${rawQ})
        OR official_name ILIKE ${likePattern}
        OR coalesce(translated_names->>'en', '') ILIKE ${likePattern}
        OR coalesce(translated_names->>'hi', '') ILIKE ${likePattern}
        OR coalesce(translated_names->>'mr', '') ILIKE ${likePattern}
        OR coalesce(overview->>'objective', '') ILIKE ${likePattern}
        OR coalesce(overview->'simple_explanation'->>'en', '') ILIKE ${likePattern}
        OR coalesce(overview->'simple_explanation'->>'hi', '') ILIKE ${likePattern}
        OR coalesce(overview->'simple_explanation'->>'mr', '') ILIKE ${likePattern}
      )`);
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    let orderSql = sql`ORDER BY official_name ASC`;
    if (params.sort === "name_desc") {
      orderSql = sql`ORDER BY official_name DESC`;
    } else if (params.sort === "id_asc") {
      orderSql = sql`ORDER BY scheme_id ASC`;
    }

    // Real total count query
    const countRes = await db.execute(sql`SELECT count(*)::int as total FROM schemes ${whereClause}`);
    const countRows = (countRes.rows || countRes) as Array<{ total?: number | string; count?: number | string }>;
    const totalCount = Number(countRows[0]?.total ?? countRows[0]?.count ?? 0);

    const query = sql`
      SELECT scheme_id, parent_scheme_id, official_name, translated_names, level,
             scheme_type, implementing_state, department_id, overview, benefits,
             min_age, max_age, min_income, max_income, allowed_genders, states,
             district_ids, benefit_type, beneficiary_categories, status,
             accepting_applications, last_verified, confidence_level, data_completeness,
             translation_status, is_test
      FROM schemes
      ${whereClause}
      ${orderSql}
      LIMIT ${limit + 1} OFFSET ${offset}
    `;

    const res = await db.execute(query);
    const rawRows = (res.rows || res) as Array<Record<string, unknown>>;

    const hasNext = rawRows.length > limit;
    const paginated = hasNext ? rawRows.slice(0, limit) : rawRows;
    const nextCursor = hasNext ? Buffer.from(String(offset + limit)).toString("base64") : null;

    const items = paginated.map((s) => {
      const trans = typeof s.translated_names === "string" ? JSON.parse(s.translated_names) : s.translated_names;
      const ov = typeof s.overview === "string" ? JSON.parse(s.overview) : s.overview;
      const localized = localize(s as {
        official_name: string;
        translated_names?: unknown;
        overview?: unknown;
        translation_status?: unknown;
      }, lang);

      if (params.view === "card") {
        return {
          scheme_id: s.scheme_id,
          official_name: s.official_name,
          display_name: localized.display_name,
          level: s.level,
          department_id: s.department_id,
          benefit_type: s.benefit_type,
          simple_explanation: localized.simple_explanation,
          status: s.status,
          accepting_applications: s.accepting_applications,
          min_age: s.min_age,
          max_age: s.max_age,
          lang_served: localized.lang_served,
          lang_fallback: localized.lang_fallback,
          display_name_fallback: localized.display_name_fallback,
          explanation_fallback: localized.explanation_fallback,
        };
      }

      return {
        scheme_id: s.scheme_id,
        parent_scheme_id: s.parent_scheme_id,
        official_name: s.official_name,
        display_name: localized.display_name,
        translated_names: trans,
        level: s.level,
        scheme_type: s.scheme_type,
        implementing_state: s.implementing_state,
        department_id: s.department_id,
        overview: ov,
        benefits: typeof s.benefits === "string" ? JSON.parse(s.benefits) : s.benefits,
        min_age: s.min_age,
        max_age: s.max_age,
        benefit_type: s.benefit_type,
        status: s.status,
        accepting_applications: s.accepting_applications,
        lang_served: localized.lang_served,
        lang_fallback: localized.lang_fallback,
        display_name_fallback: localized.display_name_fallback,
        explanation_fallback: localized.explanation_fallback,
      };
    });

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      lang_served: lang,
    };
  }

  /**
   * Queries schemes with filters, sorting, cursor pagination, and projection.
   */
  static async listSchemes(params: SchemeQueryParams) {
    if (params.source === "db") {
      return this.searchSchemesDb(params);
    }

    const lang = params.lang || "en";
    const allSchemes = await this.getCatalogueDataset();

    // Apply fast in-memory filtering
    let filtered = allSchemes.filter((s) => {
      // Exclude test schemes unless explicitly requested
      if (!params.include_test && s.is_test) return false;

      if (params.status && s.status.toUpperCase() !== params.status.toUpperCase()) return false;
      if (params.level && s.level.toUpperCase() !== params.level.toUpperCase()) return false;
      if (params.department && s.department_id?.toUpperCase() !== params.department.toUpperCase()) return false;
      if (params.benefit_type && s.benefit_type?.toUpperCase() !== params.benefit_type.toUpperCase()) return false;
      if (params.accepting_applications && s.accepting_applications.toUpperCase() !== params.accepting_applications.toUpperCase()) return false;

      // Category filter
      if (params.category || params.beneficiary_category) {
        const cat = (params.category || params.beneficiary_category)!.toUpperCase();
        const cats = (s.beneficiary_categories as string[]) || [];
        if (!cats.some((c) => c.toUpperCase() === cat)) return false;
      }

      // State filter
      if (params.state) {
        const st = params.state.toUpperCase();
        const states = (s.states as string[]) || [];
        if (s.implementing_state?.toUpperCase() !== st && !states.some((x) => x.toUpperCase() === st) && !states.includes("ALL_INDIA")) {
          return false;
        }
      }

      // District filter (schemes with matching district, or nationwide ALL_INDIA, or without specific district restriction)
      if (params.district) {
        const dist = params.district.toUpperCase();
        const dists = (s.district_ids as string[]) || [];
        const states = (s.states as string[]) || [];
        const matchesDistrict = dists.some((d) => d.toUpperCase() === dist);
        const isNationwide = states.includes("ALL_INDIA");
        if (dists.length > 0 && !matchesDistrict && !isNationwide) {
          return false;
        }
      }

      // Full text query q (searches names, objective, and simple explanations in en, hi, mr)
      if (params.q) {
        const query = params.q.toLowerCase();
        const trans = s.translated_names as { en: string; hi?: string; mr?: string };
        const ov = s.overview as { objective?: string; simple_explanation?: { en?: string; hi?: string; mr?: string } };
        const match =
          s.official_name.toLowerCase().includes(query) ||
          trans?.en?.toLowerCase().includes(query) ||
          (trans?.hi && trans.hi.toLowerCase().includes(query)) ||
          (trans?.mr && trans.mr.toLowerCase().includes(query)) ||
          (ov?.objective && ov.objective.toLowerCase().includes(query)) ||
          (ov?.simple_explanation?.en && ov.simple_explanation.en.toLowerCase().includes(query)) ||
          (ov?.simple_explanation?.hi && ov.simple_explanation.hi.toLowerCase().includes(query)) ||
          (ov?.simple_explanation?.mr && ov.simple_explanation.mr.toLowerCase().includes(query));
        if (!match) return false;
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (params.sort === "name_desc") {
        return b.official_name.localeCompare(a.official_name);
      }
      if (params.sort === "id_asc") {
        return a.scheme_id.localeCompare(b.scheme_id);
      }
      return a.official_name.localeCompare(b.official_name);
    });

    // Cursor pagination (offset encoded in cursor)
    let offset = 0;
    if (params.cursor) {
      try {
        const decoded = Buffer.from(params.cursor, "base64").toString("utf8");
        offset = parseInt(decoded, 10) || 0;
      } catch {
        offset = 0;
      }
    }

    const limit = params.limit || 20;
    const paginated = filtered.slice(offset, offset + limit);
    const hasNext = offset + limit < filtered.length;
    const nextCursor = hasNext ? Buffer.from(String(offset + limit)).toString("base64") : null;

    // View projection & localization
    const items = paginated.map((s) => {
      const localized = localize(s, lang);

      if (params.view === "card") {
        const card: Record<string, unknown> = {
          scheme_id: s.scheme_id,
          official_name: s.official_name,
          display_name: localized.display_name,
          level: s.level,
          department_id: s.department_id,
          benefit_type: s.benefit_type,
          simple_explanation: localized.simple_explanation,
          status: s.status,
          accepting_applications: s.accepting_applications,
          min_age: s.min_age,
          max_age: s.max_age,
          lang_served: localized.lang_served,
          lang_fallback: localized.lang_fallback,
          display_name_fallback: localized.display_name_fallback,
          explanation_fallback: localized.explanation_fallback,
        };
        return card;
      }

      // Detail view with field projection support
      const detail: Record<string, unknown> = {
        scheme_id: s.scheme_id,
        parent_scheme_id: s.parent_scheme_id,
        official_name: s.official_name,
        display_name: localized.display_name,
        translated_names: s.translated_names,
        level: s.level,
        scheme_type: s.scheme_type,
        implementing_state: s.implementing_state,
        department_id: s.department_id,
        overview: s.overview,
        benefits: s.benefits,
        min_age: s.min_age,
        max_age: s.max_age,
        min_income: s.min_income,
        max_income: s.max_income,
        allowed_genders: s.allowed_genders,
        states: s.states,
        district_ids: s.district_ids,
        status: s.status,
        accepting_applications: s.accepting_applications,
        last_verified: s.last_verified,
        confidence_level: s.confidence_level,
        data_completeness: s.data_completeness,
        translation_status: s.translation_status,
        lang_served: localized.lang_served,
        lang_fallback: localized.lang_fallback,
        display_name_fallback: localized.display_name_fallback,
        explanation_fallback: localized.explanation_fallback,
      };

      if (params.fields) {
        const requestedFields = params.fields.split(",").map((f) => f.trim());
        const projected: Record<string, unknown> = { scheme_id: s.scheme_id };
        for (const f of requestedFields) {
          if (f in detail) projected[f] = detail[f];
        }
        projected["lang_served"] = detail["lang_served"];
        projected["lang_fallback"] = detail["lang_fallback"];
        projected["display_name_fallback"] = detail["display_name_fallback"];
        projected["explanation_fallback"] = detail["explanation_fallback"];
        return projected;
      }

      return detail;
    });

    return {
      items,
      next_cursor: nextCursor,
      total_count: filtered.length,
      lang_served: lang,
    };
  }

  /**
   * Retrieves faceted counts across levels, departments, benefit types, statuses, etc.
   */
  static async getFacets() {
    const all = await this.getCatalogueDataset();
    const levels: Record<string, number> = {};
    const departments: Record<string, number> = {};
    const benefit_types: Record<string, number> = {};
    const beneficiary_categories: Record<string, number> = {};
    const statuses: Record<string, number> = {};
    const accepting_applications: Record<string, number> = {};

    for (const s of all) {
      levels[s.level] = (levels[s.level] || 0) + 1;
      if (s.department_id) {
        departments[s.department_id] = (departments[s.department_id] || 0) + 1;
      }
      if (s.benefit_type) {
        benefit_types[s.benefit_type] = (benefit_types[s.benefit_type] || 0) + 1;
      }
      statuses[s.status] = (statuses[s.status] || 0) + 1;
      accepting_applications[s.accepting_applications] =
        (accepting_applications[s.accepting_applications] || 0) + 1;

      const cats = (s.beneficiary_categories as string[]) || [];
      for (const c of cats) {
        beneficiary_categories[c] = (beneficiary_categories[c] || 0) + 1;
      }
    }

    return {
      dataset_version: rulesCache.getVersion(),
      levels,
      departments,
      benefit_types,
      beneficiary_categories,
      statuses,
      accepting_applications,
    };
  }

  /**
   * Deep resolution of scheme by ID including documents, help centres, steps, and sources.
   */
  static async getSchemeById(schemeId: string, lang: "en" | "hi" | "mr" = "en") {
    const found = await db
      .select()
      .from(schema.schemes)
      .where(eq(schema.schemes.scheme_id, schemeId))
      .limit(1);

    if (found.length === 0 || !found[0]) return null;
    const s = found[0];

    // Resolve documents
    const rawObj = s.raw as Record<string, unknown>;
    const rawDocs = (rawObj.documents_required as Array<Record<string, unknown>>) || [];
    const resolvedDocs = [];
    for (const dReq of rawDocs) {
      const docId = String(dReq.document_id);
      const meta = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.document_id, docId))
        .limit(1);

      resolvedDocs.push({
        ...dReq,
        details: meta[0] || null,
      });
    }

    // Resolve help centres
    const assistance = (rawObj.assistance as Record<string, unknown>) || {};
    const helpCentreIds = (assistance.help_centre_ids as string[]) || [];
    const resolvedHelpCentres = [];
    for (const hcId of helpCentreIds) {
      const hc = await db
        .select()
        .from(schema.helpCentres)
        .where(eq(schema.helpCentres.help_centre_id, hcId))
        .limit(1);
      if (hc[0]) resolvedHelpCentres.push(hc[0]);
    }

    // Translation localization
    const localized = localize(s, lang);

    return {
      ...s,
      display_name: localized.display_name,
      simple_explanation_localized: localized.simple_explanation,
      display_name_fallback: localized.display_name_fallback,
      explanation_fallback: localized.explanation_fallback,
      resolved_documents: resolvedDocs,
      resolved_help_centres: resolvedHelpCentres,
      application_info: rawObj.application || null,
      tracking_info: rawObj.tracking || null,
      quality_flags: {
        data_completeness: s.data_completeness,
        confidence_level: s.confidence_level,
        translation_status: s.translation_status,
      },
      lang_served: localized.lang_served,
      lang_fallback: localized.lang_fallback,
    };
  }

  /**
   * Help centres lookup with distance calculation if coordinates provided.
   */
  static async listHelpCentres(filter: {
    district?: string;
    taluka?: string;
    service?: string;
    scheme_id?: string;
    lat?: number;
    lon?: number;
    limit?: number;
  }) {
    let centres = await db.select().from(schema.helpCentres);

    if (filter.district) {
      const d = filter.district.toUpperCase();
      centres = centres.filter((c) => c.district.toUpperCase() === d);
    }
    if (filter.taluka) {
      const t = filter.taluka.toUpperCase();
      centres = centres.filter((c) => c.taluka?.toUpperCase() === t);
    }
    if (filter.service) {
      const s = filter.service.toLowerCase();
      centres = centres.filter((c) => {
        const services = (c.available_services as string[]) || [];
        return services.some((srv) => srv.toLowerCase().includes(s));
      });
    }
    if (filter.scheme_id) {
      const schId = filter.scheme_id.toUpperCase();
      centres = centres.filter((c) => {
        const supported = (c.supported_schemes as string[]) || [];
        return supported.some((id) => id.toUpperCase() === schId);
      });
    }

    // Distance sorting
    if (filter.lat !== undefined && filter.lon !== undefined) {
      const lat1 = filter.lat;
      const lon1 = filter.lon;
      centres.sort((a, b) => {
        if (a.latitude === null || a.longitude === null) return 1;
        if (b.latitude === null || b.longitude === null) return -1;
        const distA = Math.hypot(a.latitude - lat1, a.longitude - lon1);
        const distB = Math.hypot(b.latitude - lat1, b.longitude - lon1);
        return distA - distB;
      });
    }

    return centres.slice(0, filter.limit || 20);
  }
}
