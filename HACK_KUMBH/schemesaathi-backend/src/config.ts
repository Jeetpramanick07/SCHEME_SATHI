import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  databaseUrl: string;
  dbSslRejectUnauthorized: boolean;
  staleDays: number;
  apiKeyCitizen: string;
  apiKeyAdmin: string;
  indicVoiceUrl: string;
  voiceMock: boolean;
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

if (isProd && (!process.env.API_KEY_CITIZEN || !process.env.API_KEY_ADMIN)) {
  throw new Error("Missing required API keys in production environment (API_KEY_CITIZEN, API_KEY_ADMIN)");
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL || "",
  dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  staleDays: parseInt(process.env.STALE_DAYS || "90", 10),
  apiKeyCitizen: process.env.API_KEY_CITIZEN || "",
  apiKeyAdmin: process.env.API_KEY_ADMIN || "",
  indicVoiceUrl: process.env.INDIC_VOICE_URL || "http://localhost:8000",
  voiceMock: process.env.VOICE_MOCK === "true",
};
