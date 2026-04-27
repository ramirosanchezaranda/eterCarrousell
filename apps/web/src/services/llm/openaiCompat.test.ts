/**
 * Tests del parser tolerante. Cubren outputs reales que devuelven LLMs
 * débiles (Llama 3.2 vía Ollama, Mistral-small, Gemini-Flash) y rompían
 * la versión anterior.
 */
import { describe, expect, it } from 'vitest';
import { parseSlidesJson } from './openaiCompat';

describe('parseSlidesJson — outputs reales malos', () => {
  const ARRAY_BARE = `[
    {"type":"cover","line1":"Portadas que frenan el scroll"},
    {"type":"observation","line1":"La primera imagen decide si el usuario se queda o pasa porque la atención humana es escasa hoy día."},
    {"type":"contrast","line1":"La mayoría diseña portadas para gustarse a sí misma, no al lector","line2":"El lector decide en dos segundos."},
    {"type":"quote","line1":"Una portada no se diseña, se edita: cada elemento ya pasó por una negociación."},
    {"type":"stat","number":"7 de 10","line1":"carruseles pierden lectores en la portada","caption":"OBSERVACIÓN INTERNA · ETERCORE"},
    {"type":"cta","line1":"Si tu portada no gana en dos segundos perdió todo","line2":"Probá una palabra."}
  ]`;

  it('acepta array desnudo', () => {
    const slides = parseSlidesJson(ARRAY_BARE);
    expect(slides).toHaveLength(6);
    expect(slides[0]?.type).toBe('cover');
  });

  it('acepta {"slides":[...]} (forma canónica del nuevo prompt)', () => {
    const wrapped = `{"slides": ${ARRAY_BARE}}`;
    const slides = parseSlidesJson(wrapped);
    expect(slides).toHaveLength(6);
  });

  it('acepta {"data":[...]} y {"carousel":[...]} (LLMs caprichosos)', () => {
    expect(parseSlidesJson(`{"data": ${ARRAY_BARE}}`)).toHaveLength(6);
    expect(parseSlidesJson(`{"carousel": ${ARRAY_BARE}}`)).toHaveLength(6);
  });

  it('acepta basura antes y después', () => {
    const dirty = `Aquí va tu carrusel:\n\n\`\`\`json\n${ARRAY_BARE}\n\`\`\`\n\n¡Espero te sirva!`;
    expect(parseSlidesJson(dirty)).toHaveLength(6);
  });

  it('acepta fences ```json sin texto extra', () => {
    expect(parseSlidesJson('```json\n' + ARRAY_BARE + '\n```')).toHaveLength(6);
  });

  it('coerce number numérico a string ("number": 7 → "7")', () => {
    const arr = `[{"type":"stat","number":7,"line1":"carruseles pierden lectores en la portada"}]`;
    const slides = parseSlidesJson(arr);
    expect(slides[0]?.number).toBe('7');
  });

  it('descarta slides con line1 vacío pero no rompe el resto', () => {
    const arr = `[
      {"type":"cover","line1":""},
      {"type":"observation","line1":"Texto válido sobre el tema con suficientes palabras para pasar el contrato"}
    ]`;
    const slides = parseSlidesJson(arr);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.type).toBe('observation');
  });

  it('respuesta vacía tira error', () => {
    expect(() => parseSlidesJson('')).toThrow(/vacía/i);
  });

  it('JSON inválido tira error', () => {
    expect(() => parseSlidesJson('no es json {{')).toThrow();
  });

  it('respuesta no-array y no-objeto-conocido tira error', () => {
    expect(() => parseSlidesJson('"solo un string"')).toThrow();
  });

  it('todas las slides inválidas tira error', () => {
    const arr = `[{"type":"banner","line1":"X"},{"type":"cover","line1":""}]`;
    expect(() => parseSlidesJson(arr)).toThrow(/validación/i);
  });

  it('trim de espacios al borde de line1', () => {
    const arr = `[{"type":"cover","line1":"   Hola mundo   "}]`;
    const slides = parseSlidesJson(arr);
    expect(slides[0]?.line1).toBe('Hola mundo');
  });
});

describe('parseSlidesJson — escenarios típicos de Llama 3.2', () => {
  it('Llama empieza con "Here is your carousel:" antes del JSON', () => {
    const raw = `Here is your carousel:\n\n[{"type":"cover","line1":"Portadas magnéticas"}]`;
    expect(parseSlidesJson(raw)).toHaveLength(1);
  });

  it('Llama envuelve en {"output": [...]}', () => {
    const raw = `{"output":[{"type":"cover","line1":"Portadas magnéticas"}]}`;
    // No es una key conocida → cae al extractor de array por límites [].
    expect(parseSlidesJson(raw)).toHaveLength(1);
  });

  it('Llama olvida una coma — JSON inválido → error claro', () => {
    const raw = `[{"type":"cover","line1":"X"} {"type":"cta","line1":"Y"}]`;
    expect(() => parseSlidesJson(raw)).toThrow();
  });
});
