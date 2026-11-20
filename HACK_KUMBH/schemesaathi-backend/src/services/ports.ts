/**
 * External service integration ports (Out of scope for core backend MVP).
 * Kept as clean decoupled interfaces for future voice, notification, and LLM plugins.
 */

export interface NotificationPayload {
  recipientId: string;
  channel: "sms" | "whatsapp" | "email" | "in_app";
  templateId: string;
  variables: Record<string, string>;
  language: "en" | "hi" | "mr";
}

export interface NotificationSender {
  send(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface SpeechToTextRequest {
  audioBuffer: Buffer;
  mimeType: string;
  sourceLanguage?: "en" | "hi" | "mr";
}

export interface TextToSpeechRequest {
  text: string;
  targetLanguage: "en" | "hi" | "mr";
  voiceGender?: "male" | "female";
}

export interface SpeechProvider {
  transcribe(request: SpeechToTextRequest): Promise<{ text: string; confidence: number; detectedLanguage: string }>;
  synthesize(request: TextToSpeechRequest): Promise<{ audioBuffer: Buffer; mimeType: string }>;
}

export interface TextExplainerRequest {
  schemeName: string;
  rulesExplanation: string[];
  targetLanguage: "en" | "hi" | "mr";
  readingLevel?: "simple" | "detailed";
}

export interface TextExplainer {
  simplifyExplanation(request: TextExplainerRequest): Promise<string>;
}
