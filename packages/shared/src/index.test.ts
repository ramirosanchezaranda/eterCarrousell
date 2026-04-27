/**
 * Tests del riel anti-desvío. Cubren los puntos donde un LLM débil falla:
 *   - contrato por slide (line2 obligatorio en contrast/cta, number en stat)
 *   - palabras prohibidas
 *   - rango de palabras
 *   - anclaje al topic (tokenización + match)
 */
import { describe, expect, it } from 'vitest';
import {
  countWords,
  isSlideOnTopic,
  stripDiacritics,
  tokenizeForAnchor,
  validateSlideContract,
  GeneratedSlideSchema,
  SLIDE_CONTRACTS,
  DEFAULT_SLIDE_ORDER,
} from './index';

describe('countWords', () => {
  it('cuenta tokens alfanuméricos, ignora puntuación', () => {
    expect(countWords('Hola, mundo!')).toBe(2);
    expect(countWords('uno-dos tres')).toBe(3); // hyphen = separador
    expect(countWords('  ')).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });
  it('cuenta tildes como una palabra', () => {
    expect(countWords('diseño cambió día')).toBe(3);
  });
});

describe('stripDiacritics', () => {
  it('quita tildes y eñes', () => {
    expect(stripDiacritics('diseño café año')).toBe('diseno cafe ano');
  });
});

describe('tokenizeForAnchor', () => {
  it('quita stopwords y tokens cortos', () => {
    const tokens = tokenizeForAnchor('el diseño web impacta cuánto podés cobrar', 'es');
    expect(tokens).toContain('diseno');
    expect(tokens).toContain('impacta');
    expect(tokens).toContain('cobrar');
    expect(tokens).not.toContain('el');
    expect(tokens).not.toContain('y');
  });
  it('deduplica', () => {
    const tokens = tokenizeForAnchor('agencia agencia agencia', 'es');
    expect(tokens).toEqual(['agencia']);
  });
  it('inglés respeta stopwords inglesas', () => {
    const tokens = tokenizeForAnchor('the design and the brand', 'en');
    expect(tokens).toContain('design');
    expect(tokens).toContain('brand');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('and');
  });
});

describe('isSlideOnTopic', () => {
  const topicTokens = tokenizeForAnchor('diseño web para agencias', 'es');
  it('detecta cuando la slide menciona un token del topic', () => {
    expect(isSlideOnTopic({ type: 'cover', line1: 'Diseño web que vende' }, topicTokens)).toBe(true);
  });
  it('detecta off-topic cuando ningún token aparece', () => {
    expect(isSlideOnTopic({ type: 'cover', line1: 'Recetas de cocina italiana' }, topicTokens)).toBe(false);
  });
  it('busca también en line2/number/caption', () => {
    expect(isSlideOnTopic({ type: 'contrast', line1: 'A', line2: 'agencias modernas pierden tiempo' }, topicTokens)).toBe(true);
  });
  it('si el topic no produce tokens útiles, no falsea (retorna true)', () => {
    expect(isSlideOnTopic({ type: 'cover', line1: 'Nada' }, [])).toBe(true);
  });
  it('matchea ignorando tildes', () => {
    expect(isSlideOnTopic({ type: 'cover', line1: 'DISEÑO web es clave' }, topicTokens)).toBe(true);
  });
});

describe('validateSlideContract', () => {
  it('cover válida pasa', () => {
    expect(validateSlideContract({ type: 'cover', line1: 'Portadas que frenan el scroll' })).toBeNull();
  });

  it('cover con line1 corto falla', () => {
    const issues = validateSlideContract({ type: 'cover', line1: 'Hola' });
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('mínimo'))).toBe(true);
  });

  it('contrast sin line2 falla', () => {
    const issues = validateSlideContract({
      type: 'contrast',
      line1: 'La mayoría diseña portadas para gustarse a sí misma, no al lector',
    });
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('line2'))).toBe(true);
  });

  it('stat sin number falla', () => {
    const issues = validateSlideContract({
      type: 'stat',
      line1: 'carruseles pierden lectores en la portada',
    });
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('number'))).toBe(true);
  });

  it('cta sin line2 falla (acción corta obligatoria)', () => {
    const issues = validateSlideContract({
      type: 'cta',
      line1: 'Si tu portada no gana en dos segundos perdió todo',
    });
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('line2'))).toBe(true);
  });

  it('detecta palabra prohibida (synergy/sinergia)', () => {
    const issues = validateSlideContract({
      type: 'cover',
      line1: 'Sinergia disruptiva en redes sociales',
    });
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('prohibida'))).toBe(true);
  });

  it('detecta plantilla genérica ("este carrusel")', () => {
    const issues = validateSlideContract({
      type: 'observation',
      line1: 'Este carrusel habla de un tema interesante para todo el mundo en general estos días',
    });
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('prohibida'))).toBe(true);
  });

  it('expectedType distinto al type recibido falla', () => {
    const issues = validateSlideContract({ type: 'cover', line1: 'Algo que sirve como cover' }, 'observation');
    expect(issues).not.toBeNull();
    expect(issues!.some((r) => r.includes('esperado'))).toBe(true);
  });

  it('slide sin type es inválida', () => {
    const issues = validateSlideContract({} as any);
    expect(issues).not.toBeNull();
  });

  it('observation con 20 palabras pasa', () => {
    const text = 'La primera imagen decide si el usuario se queda o pasa porque la atención humana es muy escasa hoy día gracias';
    expect(countWords(text)).toBeGreaterThanOrEqual(20);
    expect(validateSlideContract({ type: 'observation', line1: text })).toBeNull();
  });
});

describe('SLIDE_CONTRACTS shape', () => {
  it('cubre todos los tipos del DEFAULT_SLIDE_ORDER', () => {
    for (const t of DEFAULT_SLIDE_ORDER) {
      expect(SLIDE_CONTRACTS[t]).toBeTruthy();
      expect(SLIDE_CONTRACTS[t].required.length).toBeGreaterThan(0);
    }
  });
});

describe('GeneratedSlideSchema (permisivo)', () => {
  it('acepta cover mínima', () => {
    const r = GeneratedSlideSchema.safeParse({ type: 'cover', line1: 'X' });
    expect(r.success).toBe(true);
  });
  it('rechaza line1 vacío', () => {
    const r = GeneratedSlideSchema.safeParse({ type: 'cover', line1: '' });
    expect(r.success).toBe(false);
  });
  it('rechaza type fuera del enum', () => {
    const r = GeneratedSlideSchema.safeParse({ type: 'banner', line1: 'X' });
    expect(r.success).toBe(false);
  });
});
