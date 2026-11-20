import dotenv from "dotenv";

dotenv.config();

export interface QualityGateConfig {
  minMandatoryRulesEvaluated: number;
  requireCuratedOrVerified: boolean;
  exploreCap: number;
}

function parseCorsOrigins(val?: string): boolean | string[] {
  if (!val || val === "*" || val === "true") return true;
  if (val === "false") return false;
  const parts = val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length > 0 ? parts : true;
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  databaseUrl: string;
  dbSslRejectUnauthorized: boolean;
  corsOrigins: boolean | string[];
  staleDays: number;
  apiKeyCitizen: string;
  apiKeyVolunteer: string;
  apiKeyAdmin: string;
  enableSimulatedPrefill: boolean;
  qualityGate: QualityGateConfig;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@localhost:5432/schemesaathi",
  dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS),
  staleDays: parseInt(process.env.STALE_DAYS || "90", 10),
  apiKeyCitizen: process.env.API_KEY_CITIZEN || "citizen-secret-key",
  apiKeyVolunteer: process.env.API_KEY_VOLUNTEER || "volunteer-secret-key",
  apiKeyAdmin: process.env.API_KEY_ADMIN || "admin-secret-key",
  enableSimulatedPrefill: process.env.ENABLE_SIMULATED_PREFILL !== "false",
  qualityGate: {
    minMandatoryRulesEvaluated: parseInt(process.env.QUALITY_GATE_MIN_MANDATORY_RULES || "1", 10),
    requireCuratedOrVerified: process.env.QUALITY_GATE_REQUIRE_CURATED !== "false",
    exploreCap: parseInt(process.env.QUALITY_GATE_EXPLORE_CAP || "20", 10),
  },
};
