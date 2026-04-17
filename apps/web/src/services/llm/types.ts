/**
 * Contrato común para todos los proveedores LLM — BFF, APIs directas y locales.
 * El UI elige un provider, guarda credenciales en localStorage, y el generador
 * llama a `provider.generate()` sin saber qué hay detrás.
 */
import type { GeneratedSlide } from '@carrousel/shared';

export type ProviderId =
  | 'anthropic-bff'
  | 'anthropic-direct'
  | 'groq'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'ollama'
  | 'lmstudio';

export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;        // para Ollama/LM Studio (http://localhost:11434 etc.)
  model?: string;           // override del modelo default
}

export interface GenerateInput {
  topic: string;
  count: number;
  language: 'es' | 'en';
  signal?: AbortSignal;
}

export interface LlmProvider {
  id: ProviderId;
  label: string;
  description: string;
  /** Tiene free tier sin tarjeta de crédito */
  free: boolean;
  /** Corre localmente en la máquina del usuario */
  local: boolean;
  /** Llamada directa desde el browser (sin BFF). False = requiere backend propio. */
  browserSafe: boolean;
  requiresApiKey: boolean;
  defaultEndpoint?: string;
  defaultModel?: string;
  docsUrl?: string;
  generate: (input: GenerateInput, config: ProviderConfig) => Promise<GeneratedSlide[]>;
}
