/**
 * Tests del wrap. Cubren el bug del 27/4: cuando el texto tenía un \n manual,
 * el segmento posterior se renderizaba en una sola línea SVG infinita en
 * lugar de wrapear por ancho. Ahora wrapText respeta los \n como hard breaks
 * Y wrappea cada segmento si supera maxChars.
 */
import { describe, expect, it } from 'vitest';
import { wrapText, wrapTextWithRanges } from './helpers';

describe('wrapText', () => {
  it('wrappea texto plano por ancho', () => {
    const out = wrapText('uno dos tres cuatro cinco seis siete ocho', 12);
    // cada línea ≤ 12 chars
    for (const line of out) expect(line.length).toBeLessThanOrEqual(12);
    expect(out.join(' ')).toBe('uno dos tres cuatro cinco seis siete ocho');
  });

  it('respeta \\n como salto de línea duro', () => {
    const out = wrapText('Hola\nMundo', 50);
    expect(out).toEqual(['Hola', 'Mundo']);
  });

  it('wrappea cada segmento separado por \\n por ancho (regresión bug 27/4)', () => {
    const text = 'Primera frase corta.\nSegunda frase mucho más larga que necesita wrap por ancho';
    const out = wrapText(text, 25);
    // La primera frase entra en una línea
    expect(out[0]).toBe('Primera frase corta.');
    // El resto está wrapeado en múltiples líneas, cada una ≤ 25 chars
    const wrapped = out.slice(1);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) expect(line.length).toBeLessThanOrEqual(25);
  });

  it('preserva línea en blanco intencional (\\n\\n)', () => {
    const out = wrapText('uno\n\ndos', 50);
    expect(out).toEqual(['uno', '', 'dos']);
  });

  it('texto sin \\n se comporta como antes', () => {
    const out = wrapText('uno dos tres', 50);
    expect(out).toEqual(['uno dos tres']);
  });
});

describe('wrapTextWithRanges', () => {
  it('respeta \\n como salto de línea duro y mantiene rangos válidos', () => {
    const text = 'Hola\nMundo';
    const out = wrapTextWithRanges(text, 50);
    expect(out.map((l) => l.text)).toEqual(['Hola', 'Mundo']);
    // Los rangos deben permitir reconstruir cada línea con text.slice(start, end).trim()
    for (const line of out) {
      expect(text.slice(line.start, line.end).trim()).toBe(line.text);
    }
  });

  it('wrappea cada segmento separado por \\n', () => {
    const text = 'Primera frase corta.\nSegunda frase larga que se wrappea';
    const out = wrapTextWithRanges(text, 20);
    expect(out[0]?.text).toBe('Primera frase corta.');
    expect(out.length).toBeGreaterThan(2);
    for (const line of out) expect(line.text.length).toBeLessThanOrEqual(20);
  });

  it('los rangos son monótonos crecientes (no se pisan)', () => {
    const text = 'uno dos tres\ncuatro cinco seis';
    const out = wrapTextWithRanges(text, 8);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.start).toBeGreaterThanOrEqual(out[i - 1]!.end);
    }
  });

  it('la suma de chars wrapeados no excede el largo original', () => {
    const text = 'Esta es una frase\ncon dos partes que wrapean por ancho';
    const out = wrapTextWithRanges(text, 10);
    const totalChars = out.reduce((sum, l) => sum + l.text.length, 0);
    // Los espacios extra que se trimean al borde son admisibles, pero no más
    // que los \n (1 char) + un par de espacios.
    expect(totalChars).toBeLessThanOrEqual(text.length);
    expect(totalChars).toBeGreaterThanOrEqual(text.length - 8);
  });

  it('texto sin \\n se comporta como antes', () => {
    const out = wrapTextWithRanges('uno dos tres', 50);
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe('uno dos tres');
    expect(out[0]?.start).toBe(0);
    expect(out[0]?.end).toBe(12);
  });

  it('línea en blanco intencional no rompe los rangos', () => {
    const text = 'a\n\nb';
    const out = wrapTextWithRanges(text, 50);
    expect(out.map((l) => l.text)).toEqual(['a', '', 'b']);
  });
});
