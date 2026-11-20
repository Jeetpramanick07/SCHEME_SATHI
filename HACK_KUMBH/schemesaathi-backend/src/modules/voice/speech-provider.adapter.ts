import { SpeechProvider, SpeechToTextRequest, TextToSpeechRequest } from "../../services/ports.js";
import { IndicVoiceClient, type IndicLangCode } from "./client/indicVoiceClient.js";
import { config } from "../../config.js";

export class IndicSpeechProvider implements SpeechProvider {
  private client: IndicVoiceClient;

  constructor(client?: IndicVoiceClient) {
    this.client = client || new IndicVoiceClient(config.indicVoiceUrl);
  }

  async transcribe(request: SpeechToTextRequest): Promise<{ text: string; confidence: number; detectedLanguage: string }> {
    const lang: IndicLangCode = request.sourceLanguage === "hi" ? "hi" : "mr";
    const filename = request.mimeType.includes("webm") ? "audio.webm" : "audio.wav";
    const res = await this.client.transcribeAudio(request.audioBuffer, filename, lang);
    return {
      text: res.transcript,
      confidence: res.confidence ?? 1.0,
      detectedLanguage: res.lang,
    };
  }

  async synthesize(request: TextToSpeechRequest): Promise<{ audioBuffer: Buffer; mimeType: string }> {
    const lang: IndicLangCode = request.targetLanguage === "hi" ? "hi" : "mr";
    const arrayBuffer = await this.client.synthesizeSpeech(request.text, lang, { slow: true });
    return {
      audioBuffer: Buffer.from(arrayBuffer),
      mimeType: "audio/wav",
    };
  }
}
