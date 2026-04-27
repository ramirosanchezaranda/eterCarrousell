/**
 * Registry de providers. Cada entry expone metadata visible en la UI
 * (para pintar el selector y los inputs condicionales) + la función
 * `generate` real. El resto del código llama a `getProvider(id).generate()`.
 */
import type { LlmProvider, ProviderId } from './types';
import { anthropicBffGenerate, anthropicDirectGenerate } from './anthropic';
import { openaiCompatGenerate } from './openaiCompat';
import { geminiGenerate } from './gemini';
import { ollamaGenerate } from './ollama';

export const PROVIDERS: Record<ProviderId, LlmProvider> = {
  'anthropic-bff': {
    id: 'anthropic-bff',
    label: 'Anthropic (vía BFF)',
    description: 'Claude corriendo en tu servidor. La API key no sale del backend.',
    free: false, local: false, browserSafe: true, requiresApiKey: false,
    defaultModel: 'claude-sonnet-4-5',
    docsUrl: 'https://docs.anthropic.com/',
    generate: (input) => anthropicBffGenerate(input),
  },
  'anthropic-direct': {
    id: 'anthropic-direct',
    label: 'Anthropic (directo)',
    description: 'Claude con tu API key en el navegador. Fácil para pruebas, no recomendado para producción.',
    free: false, local: false, browserSafe: true, requiresApiKey: true,
    defaultModel: 'claude-sonnet-4-5',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    generate: (input, config) => anthropicDirectGenerate(input, config),
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    description: 'Ultra rápido, free tier sin tarjeta. Modelos Llama 3.1/3.3, Mixtral.',
    free: true, local: false, browserSafe: true, requiresApiKey: true,
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    docsUrl: 'https://console.groq.com/keys',
    generate: (input, config) => openaiCompatGenerate(input, config, {
      endpoint: config.endpoint ?? 'https://api.groq.com/openai/v1',
      model: config.model ?? 'llama-3.3-70b-versatile',
      apiKey: config.apiKey,
      supportsJsonMode: true,
    }),
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o / GPT-4o-mini. Requiere key con saldo.',
    free: false, local: false, browserSafe: true, requiresApiKey: true,
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
    generate: (input, config) => openaiCompatGenerate(input, config, {
      endpoint: config.endpoint ?? 'https://api.openai.com/v1',
      model: config.model ?? 'gpt-4o-mini',
      apiKey: config.apiKey,
      supportsJsonMode: true,
    }),
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini 1.5 Flash/Pro. Free tier generoso vía AI Studio.',
    free: true, local: false, browserSafe: true, requiresApiKey: true,
    defaultModel: 'gemini-1.5-flash',
    docsUrl: 'https://aistudio.google.com/apikey',
    generate: (input, config) => geminiGenerate(input, config),
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral AI',
    description: 'Mistral Large/Small. Free tier limitado.',
    free: true, local: false, browserSafe: true, requiresApiKey: true,
    defaultEndpoint: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    docsUrl: 'https://console.mistral.ai/api-keys/',
    generate: (input, config) => openaiCompatGenerate(input, config, {
      endpoint: config.endpoint ?? 'https://api.mistral.ai/v1',
      model: config.model ?? 'mistral-small-latest',
      apiKey: config.apiKey,
      supportsJsonMode: true,
    }),
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    description: 'LLM local sin costo. Necesita Ollama corriendo en tu máquina.',
    free: true, local: true, browserSafe: true, requiresApiKey: false,
    defaultEndpoint: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    docsUrl: 'https://ollama.com/download',
    generate: (input, config) => ollamaGenerate(input, config),
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    description: 'Servidor local compatible OpenAI. Levantalo desde LM Studio → "Start Server".',
    free: true, local: true, browserSafe: true, requiresApiKey: false,
    defaultEndpoint: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    docsUrl: 'https://lmstudio.ai/docs/app/api',
    generate: (input, config) => openaiCompatGenerate(input, config, {
      endpoint: config.endpoint ?? 'http://localhost:1234/v1',
      model: config.model ?? 'local-model',
      apiKey: config.apiKey ?? 'lm-studio',
      requireAuth: false,
      // LM Studio normalmente acepta json_object; si el modelo cargado no
      // lo soporta, simplemente lo ignora.
      supportsJsonMode: true,
    }),
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

export function getProvider(id: ProviderId): LlmProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Provider desconocido: ${id}`);
  return p;
}
