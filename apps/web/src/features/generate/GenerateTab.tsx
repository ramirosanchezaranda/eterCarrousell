/**
 * Tab "Generar" — selector de proveedor LLM + config + tema + botón generar.
 * Soporta Anthropic (BFF y directo), Groq, OpenAI, Gemini, Mistral,
 * Ollama y LM Studio. Las API keys se guardan en localStorage por proveedor.
 */
import { useState } from 'react';
import { Sparkles, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { BRAND } from '@/domain';
import { PROVIDER_LIST, type LlmProvider, type ProviderId } from '@/services/llm';
import { useProviderStore } from '@/state/providerStore';
import { useProjectStore } from '@/state/projectStore';
import { useGenerateCarousel } from './useGenerateCarousel';

export function GenerateTab() {
  const providerStore = useProviderStore();
  const projectStore = useProjectStore();
  const { loading, error, generate, cancel } = useGenerateCarousel();
  const provider = PROVIDER_LIST.find((p) => p.id === providerStore.activeProvider) ?? PROVIDER_LIST[0]!;
  const config = providerStore.configs[provider.id] ?? {};
  const [showKey, setShowKey] = useState(false);

  return (
    <>
      <SectionTitle>Tema del carrusel</SectionTitle>
      <textarea
        value={projectStore.topic}
        onChange={(e) => projectStore.setTopic(e.target.value)}
        rows={3}
        placeholder="Ej: por qué el diseño web impacta cuánto podés cobrar"
        style={textareaStyle}
      />

      <SectionTitle>Proveedor LLM</SectionTitle>
      <select
        value={provider.id}
        onChange={(e) => providerStore.setActiveProvider(e.target.value as ProviderId)}
        style={selectStyle}
      >
        {PROVIDER_LIST.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}{p.free ? ' · free' : ''}{p.local ? ' · local' : ''}
          </option>
        ))}
      </select>
      <p style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.5, margin: '8px 0 12px' }}>
        {provider.description}
        {provider.docsUrl && (
          <>
            {' '}
            <a
              href={provider.docsUrl} target="_blank" rel="noreferrer"
              style={{ color: BRAND.blueLight, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            >
              docs <ExternalLink size={10} />
            </a>
          </>
        )}
      </p>

      <ProviderConfigForm
        provider={provider}
        config={config}
        onChange={(patch) => providerStore.setConfig(provider.id, patch)}
        showKey={showKey}
        onToggleShow={() => setShowKey((v) => !v)}
      />

      <button
        onClick={() => (loading ? cancel() : void generate(projectStore.topic))}
        disabled={!projectStore.topic.trim() || (provider.requiresApiKey && !config.apiKey)}
        style={{
          width: '100%', marginTop: 14, padding: '12px 14px',
          background: loading ? '#7A2222' : BRAND.blue, border: 'none', borderRadius: 6,
          color: BRAND.cream, fontWeight: 700, fontSize: 12, letterSpacing: 1,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
        {loading
          ? 'CANCELAR'
          : projectStore.slides.length > 0
          ? 'REESCRIBIR TEXTOS'
          : 'GENERAR 6 SLIDES'}
      </button>
      {projectStore.slides.length > 0 && (
        <p style={{ fontSize: 10, opacity: 0.6, lineHeight: 1.5, marginTop: 8 }}>
          Se actualizan solo los textos. Fondo, decors, efectos y posiciones se preservan.
        </p>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 10, background: '#4A1515', borderRadius: 4, fontSize: 11, lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      <p style={{ fontSize: 10, opacity: 0.45, lineHeight: 1.5, marginTop: 16 }}>
        Las API keys se guardan en tu navegador (localStorage), nunca se envían a ningún servidor que no sea el proveedor elegido.
      </p>
    </>
  );
}

function ProviderConfigForm({
  provider, config, onChange, showKey, onToggleShow,
}: {
  provider: LlmProvider;
  config: { apiKey?: string; endpoint?: string; model?: string };
  onChange: (patch: { apiKey?: string; endpoint?: string; model?: string }) => void;
  showKey: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div>
      {provider.requiresApiKey && (
        <>
          <Label>API key</Label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={config.apiKey ?? ''}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              placeholder={provider.id === 'groq' ? 'gsk_...' : provider.id === 'openai' ? 'sk-...' : 'tu key'}
              autoComplete="off"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={onToggleShow}
              type="button"
              title={showKey ? 'Ocultar' : 'Mostrar'}
              style={iconBtnStyle}
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </>
      )}
      {(provider.local || provider.defaultEndpoint) && (
        <>
          <Label>Endpoint {provider.local && '(local)'}</Label>
          <input
            type="text"
            value={config.endpoint ?? provider.defaultEndpoint ?? ''}
            onChange={(e) => onChange({ endpoint: e.target.value })}
            placeholder={provider.defaultEndpoint}
            style={inputStyle}
          />
        </>
      )}
      <Label>Modelo</Label>
      <input
        type="text"
        value={config.model ?? provider.defaultModel ?? ''}
        onChange={(e) => onChange({ model: e.target.value })}
        placeholder={provider.defaultModel}
        style={inputStyle}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, marginTop: 12 }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, opacity: 0.6, marginTop: 8, marginBottom: 3, letterSpacing: 0.6 }}>{children}</div>;
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: 10, background: '#14141E', border: `1px solid ${BRAND.blue}40`,
  borderRadius: 6, color: BRAND.cream, fontFamily: 'inherit', fontSize: 12, resize: 'vertical',
};
const selectStyle: React.CSSProperties = {
  width: '100%', padding: 10, background: '#14141E', border: `1px solid ${BRAND.blue}40`,
  borderRadius: 6, color: BRAND.cream, fontFamily: 'inherit', fontSize: 12,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: 8, background: '#14141E', border: `1px solid ${BRAND.cream}20`,
  borderRadius: 4, color: BRAND.cream, fontFamily: 'monospace', fontSize: 11,
};
const iconBtnStyle: React.CSSProperties = {
  padding: '0 10px', background: '#14141E', border: `1px solid ${BRAND.cream}20`,
  borderRadius: 4, color: BRAND.cream, cursor: 'pointer', display: 'flex', alignItems: 'center',
};
