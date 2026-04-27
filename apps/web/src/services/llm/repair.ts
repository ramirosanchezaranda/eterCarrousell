/**
 * Pipeline anti-desvío: valida cada slide contra su contrato + anclaje al
 * topic, identifica los slots rotos, y dispara una reparación selectiva
 * (segundo prompt corto que pide SOLO esos slots).
 *
 * El flujo en `useGenerateCarousel` es:
 *
 *   1. provider.generate() → slides candidatas
 *   2. validateAndPlanRepair() → [okSlides, repairSlots]
 *   3. si hay slots rotos: callRepair() → slides nuevas para esos slots
 *   4. si todavía quedan rotos: deterministicFallback() → relleno local
 *      derivado del topic (último recurso, garantiza 6 slides utilizables)
 *
 * Esto blinda al sistema contra:
 *   - LLMs que devuelven 5/6 slides bien y 1 rota → solo regeneramos esa.
 *   - LLMs que se desvían del topic → detectado por anclaje, mandado a repair.
 *   - LLMs que ignoran "line2 obligatorio" en contrast/cta → detectado por contrato.
 *   - LLMs que devuelven JSON cortado → recuperación parcial + repair.
 *   - Falla total de la API → fallback determinístico (no es bonito pero abre).
 */
import {
  DEFAULT_SLIDE_ORDER,
  type GeneratedSlide,
  type SlideType,
  isSlideOnTopic,
  tokenizeForAnchor,
  validateSlideContract,
} from '@carrousel/shared';
import { buildRepairPrompt, type RepairSlot } from './prompt';
import { fetchWithRetry } from './http';
import { parseSlidesJson } from './openaiCompat';
import type { GenerateInput, LlmProvider, ProviderConfig, ProviderId } from './types';

export interface ValidationPlan {
  /** Slides que ya pasaron contrato + anclaje, ordenadas por slot. */
  ok: Array<GeneratedSlide & { slot: number }>;
  /** Slots que necesitan repair. */
  repair: RepairSlot[];
}

/**
 * Mapea las slides recibidas a la posición esperada (DEFAULT_SLIDE_ORDER) y
 * decide cuáles pasan y cuáles necesitan reparación.
 *
 * Estrategia de mapeo: para cada slot esperado, tomamos la primera slide
 * disponible cuyo `type` coincide. Si no hay coincidencia por tipo, marcamos
 * el slot como roto (placeholder vacío en `ok`, entry en `repair`).
 *
 * Esto perdona el orden: un LLM que devuelve [observation, cover, ...] sigue
 * funcionando si los tipos están todos, simplemente reordenamos.
 */
export function planValidation(
  slides: ReadonlyArray<Partial<GeneratedSlide>>,
  topic: string,
  language: 'es' | 'en',
  expectedOrder: ReadonlyArray<SlideType> = DEFAULT_SLIDE_ORDER,
): ValidationPlan {
  const topicTokens = tokenizeForAnchor(topic, language);
  const remaining = slides.map((s, i) => ({ s, i, used: false }));

  const ok: ValidationPlan['ok'] = [];
  const repair: RepairSlot[] = [];

  for (let slot = 0; slot < expectedOrder.length; slot++) {
    const expectedType = expectedOrder[slot]!;
    // Buscamos la PRIMERA slide del array original con type que matchee y no usada todavía.
    const candidate = remaining.find((r) => !r.used && r.s?.type === expectedType);
    if (!candidate) {
      repair.push({ slot, type: expectedType, reasons: ['slide ausente en la respuesta'] });
      continue;
    }
    candidate.used = true;
    const slide = candidate.s as GeneratedSlide;
    const contractIssues = validateSlideContract(slide, expectedType);
    const onTopic = isSlideOnTopic(slide, topicTokens);

    // Anclaje al topic SOLO se exige en cover y observation: los slides más
    // narrativos (contrast/quote/stat/cta) pueden hablar lateralmente sin
    // mencionar el topic literal y eso no es un error editorial.
    const requireOnTopic = expectedType === 'cover' || expectedType === 'observation';
    const offTopic = requireOnTopic && !onTopic;

    const reasons = [
      ...(contractIssues ?? []),
      ...(offTopic ? [`no menciona el tema "${topic}"`] : []),
    ];

    if (reasons.length === 0) {
      ok.push({ ...slide, slot });
    } else {
      repair.push({ slot, type: expectedType, reasons });
    }
  }

  return { ok, repair };
}

/**
 * Llama al provider con el repair prompt. Retorna las slides recibidas
 * (validadas básicamente). NO hace re-validación contractual: la decisión
 * de aceptar o caer al fallback es del caller.
 */
export async function callRepair(
  provider: LlmProvider,
  providerId: ProviderId,
  config: ProviderConfig,
  input: GenerateInput,
  slots: ReadonlyArray<RepairSlot>,
): Promise<GeneratedSlide[]> {
  const prompt = buildRepairPrompt(input.topic, slots, input.language);

  // Anthropic-direct y BFF tienen sus propios endpoints; OpenAI-compat,
  // gemini y ollama acceden vía función específica. Para mantener el
  // pipeline simple, reutilizamos el provider.generate() con un input
  // sintético: pasamos el repair prompt como `topic`. Es un hack feo
  // pero práctico — alternativa sería duplicar lógica HTTP por provider.
  //
  // Excepción: BFF no acepta un repair prompt (rate-limita por IP y siempre
  // pega a Claude con el system prompt fijo). Para BFF caemos a la lógica
  // por defecto: re-generamos completo. El caller decide si lo usa.
  if (providerId === 'anthropic-bff') {
    // Re-generamos completo y dejamos que la validación posterior se encargue.
    return provider.generate(input, config);
  }

  // Llamada cruda con el repair prompt como system+user combinado.
  return rawProviderCall(providerId, config, prompt, input.signal);
}

/**
 * Llamada cruda a cada provider con un prompt arbitrario (usado para repair).
 * Comparte timeout/retry con el flujo principal.
 */
async function rawProviderCall(
  providerId: ProviderId,
  config: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedSlide[]> {
  if (providerId === 'gemini') {
    const apiKey = config.apiKey;
    if (!apiKey) throw new Error('API key de Gemini requerida');
    const model = config.model ?? 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json',
        },
      }),
      signal,
    });
    if (!resp.ok) throw new Error(`Gemini repair ${resp.status}`);
    const data = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return parseSlidesJson(text);
  }

  if (providerId === 'ollama') {
    const endpoint = (config.endpoint ?? 'http://localhost:11434').replace(/\/$/, '');
    const model = config.model ?? 'llama3.2';
    const resp = await fetchWithRetry(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0.3 },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
      timeoutMs: 90_000,
      retries: 1,
    });
    if (!resp.ok) throw new Error(`Ollama repair ${resp.status}`);
    const data = await resp.json() as { message?: { content?: string } };
    return parseSlidesJson(data.message?.content ?? '');
  }

  if (providerId === 'anthropic-direct') {
    const apiKey = config.apiKey;
    if (!apiKey) throw new Error('API key de Anthropic requerida');
    const model = config.model ?? 'claude-sonnet-4-5';
    const resp = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });
    if (!resp.ok) throw new Error(`Anthropic repair ${resp.status}`);
    const data = await resp.json() as { content?: Array<{ type: string; text: string }> };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return parseSlidesJson(text);
  }

  // OpenAI-compat: groq, openai, mistral, lmstudio
  const endpointMap: Partial<Record<ProviderId, string>> = {
    groq: 'https://api.groq.com/openai/v1',
    openai: 'https://api.openai.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    lmstudio: 'http://localhost:1234/v1',
  };
  const modelMap: Partial<Record<ProviderId, string>> = {
    groq: 'llama-3.3-70b-versatile',
    openai: 'gpt-4o-mini',
    mistral: 'mistral-small-latest',
    lmstudio: 'local-model',
  };
  const endpoint = (config.endpoint ?? endpointMap[providerId] ?? '').replace(/\/$/, '');
  const model = config.model ?? modelMap[providerId] ?? 'local-model';
  const apiKey = config.apiKey ?? (providerId === 'lmstudio' ? 'lm-studio' : undefined);
  const resp = await fetchWithRetry(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
    signal,
  });
  if (!resp.ok) throw new Error(`Repair ${providerId} ${resp.status}`);
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseSlidesJson(text);
}

/**
 * Mergea las slides reparadas en el plan original. Para cada slot pedido,
 * buscamos la primera slide reparada con type matching. Si la reparada
 * todavía no pasa contrato/anclaje, devolvemos `null` para ese slot
 * (el caller usará el fallback determinístico).
 */
export function mergeRepair(
  plan: ValidationPlan,
  repaired: ReadonlyArray<Partial<GeneratedSlide>>,
  topic: string,
  language: 'es' | 'en',
): { slides: GeneratedSlide[]; stillBroken: SlideType[] } {
  const topicTokens = tokenizeForAnchor(topic, language);
  // Slot → slide acumulada. Empezamos con las que ya estaban OK.
  const bySlot = new Map<number, GeneratedSlide>();
  for (const ok of plan.ok) {
    const { slot: _slot, ...rest } = ok;
    void _slot;
    bySlot.set(ok.slot, rest as GeneratedSlide);
  }

  const repairPool = repaired.map((s, i) => ({ s, i, used: false }));

  for (const slotInfo of plan.repair) {
    const cand = repairPool.find((r) => !r.used && r.s?.type === slotInfo.type);
    if (!cand) continue;
    const slide = cand.s as GeneratedSlide;
    const contractIssues = validateSlideContract(slide, slotInfo.type);
    const requireOnTopic = slotInfo.type === 'cover' || slotInfo.type === 'observation';
    const offTopic = requireOnTopic && !isSlideOnTopic(slide, topicTokens);
    if (contractIssues || offTopic) continue; // sigue rota
    cand.used = true;
    bySlot.set(slotInfo.slot, slide);
  }

  // Reconstruir el array final ordenado, identificando los que quedaron sin reparar.
  const slides: GeneratedSlide[] = [];
  const stillBroken: SlideType[] = [];
  for (let slot = 0; slot < DEFAULT_SLIDE_ORDER.length; slot++) {
    const slide = bySlot.get(slot);
    if (slide) {
      slides.push(slide);
    } else {
      stillBroken.push(DEFAULT_SLIDE_ORDER[slot]!);
    }
  }
  return { slides, stillBroken };
}

/**
 * Última red de seguridad. Genera una slide localmente sin LLM, derivada
 * directamente del topic. No es elegante editorialmente — es lo mínimo
 * para que el carrusel se abra completo. Mejor un cta plano que vacío.
 */
export function deterministicFallback(
  type: SlideType,
  topic: string,
  language: 'es' | 'en',
): GeneratedSlide {
  const t = topic.trim();
  if (language === 'en') {
    switch (type) {
      case 'cover':
        return { type, line1: t.slice(0, 80) };
      case 'observation':
        return { type, line1: `A short take on ${t}: what most people miss and why it matters in practice.` };
      case 'contrast':
        return { type, line1: `Most approaches to ${t} chase visibility instead of outcomes`, line2: 'Outcomes compound; visibility evaporates.' };
      case 'quote':
        return { type, line1: `${t} rewards the people willing to do the unglamorous work twice.` };
      case 'stat':
        return { type, number: '7 of 10', line1: `teams underestimate the cost of getting ${t} wrong`, caption: 'INTERNAL · STUDIO' };
      case 'cta':
        return { type, line1: `If ${t} matters to your business, audit it this week`, line2: 'Start with one page.' };
    }
  }
  switch (type) {
    case 'cover':
      return { type, line1: t.slice(0, 80) };
    case 'observation':
      return { type, line1: `Una mirada corta sobre ${t}: lo que la mayoría pasa por alto y por qué cambia el resultado.` };
    case 'contrast':
      return { type, line1: `La mayoría aborda ${t} buscando visibilidad antes que resultados`, line2: 'Los resultados componen, la visibilidad se evapora.' };
    case 'quote':
      return { type, line1: `${t} premia a quien acepta hacer el trabajo poco glamoroso dos veces.` };
    case 'stat':
      return { type, number: '7 de 10', line1: `equipos subestiman el costo de equivocarse en ${t}`, caption: 'OBSERVACIÓN INTERNA · ETERCORE' };
    case 'cta':
      return { type, line1: `Si ${t} importa a tu negocio, auditalo esta semana`, line2: 'Empezá por una página.' };
  }
}
