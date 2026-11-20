/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_API_KEY_CITIZEN: string;
  readonly VITE_ENABLE_VOICE_INPUT: string;
  readonly VITE_ENABLE_CHATBOT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
