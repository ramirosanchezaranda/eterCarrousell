/**
 * Configuración del proveedor LLM activo + claves de API por proveedor.
 * Persistido en localStorage. Las keys se guardan en claro (en el browser) —
 * para deploys compartidos usá `anthropic-bff` que las tiene en el server.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProviderConfig, ProviderId } from '@/services/llm';

export type PerProviderConfig = Record<ProviderId, ProviderConfig>;

export interface ProviderState {
  activeProvider: ProviderId;
  configs: PerProviderConfig;
}

export interface ProviderActions {
  setActiveProvider: (id: ProviderId) => void;
  setConfig: (id: ProviderId, patch: Partial<ProviderConfig>) => void;
  clearConfig: (id: ProviderId) => void;
}

const EMPTY: PerProviderConfig = {
  'anthropic-bff': {},
  'anthropic-direct': {},
  groq: {},
  openai: {},
  gemini: {},
  mistral: {},
  ollama: {},
  lmstudio: {},
};

export const useProviderStore = create<ProviderState & ProviderActions>()(
  persist(
    (set) => ({
      activeProvider: 'groq',
      configs: EMPTY,

      setActiveProvider: (activeProvider) => set({ activeProvider }),

      setConfig: (id, patch) => set((s) => ({
        configs: {
          ...s.configs,
          [id]: { ...(s.configs[id] ?? {}), ...patch },
        },
      })),

      clearConfig: (id) => set((s) => ({
        configs: { ...s.configs, [id]: {} },
      })),
    }),
    {
      name: 'carrousel-provider',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
