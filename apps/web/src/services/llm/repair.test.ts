/**
 * Tests del pipeline de validación + reparación + fallback.
 * Verifican que el sistema mapea correctamente slides en orden distinto,
 * detecta off-topic, y rellena con fallback determinístico cuando hace falta.
 */
import { describe, expect, it } from 'vitest';
import { planValidation, mergeRepair, deterministicFallback } from './repair';
import { DEFAULT_SLIDE_ORDER, type GeneratedSlide } from '@carrousel/shared';

const goodSet: GeneratedSlide[] = [
  { type: 'cover', line1: 'Diseño web que cambia precios' },
  { type: 'observation', line1: 'El diseño web cambia el precio que tu agencia puede cobrar porque los clientes leen calidad antes de leer servicio.' },
  { type: 'contrast', line1: 'La mayoría diseña sitios para impresionar al equipo y no al cliente que paga', line2: 'El cliente paga el resultado.' },
  { type: 'quote', line1: 'Cada decisión de diseño es una negociación entre claridad y velocidad.' },
  { type: 'stat', number: '7 de 10', line1: 'sitios subestiman el costo del rediseño', caption: 'OBSERVACIÓN INTERNA · ETERCORE' },
  { type: 'cta', line1: 'Auditá tu home esta semana antes de tu próximo cliente', line2: 'Empezá por el hero.' },
];

describe('planValidation', () => {
  it('todas válidas → ok=6, repair=0', () => {
    const plan = planValidation(goodSet, 'diseño web para agencias', 'es');
    expect(plan.ok).toHaveLength(6);
    expect(plan.repair).toHaveLength(0);
  });

  it('reordena: si llegan en orden distinto pero todos los tipos están, sigue funcionando', () => {
    const reordered = [goodSet[1], goodSet[0], ...goodSet.slice(2)] as GeneratedSlide[];
    const plan = planValidation(reordered, 'diseño web para agencias', 'es');
    expect(plan.ok).toHaveLength(6);
    expect(plan.ok[0]?.type).toBe('cover');
    expect(plan.ok[1]?.type).toBe('observation');
  });

  it('contrast sin line2 → marcada para repair', () => {
    const broken = [...goodSet];
    broken[2] = { type: 'contrast', line1: 'La mayoría diseña sitios para impresionar al equipo, no al cliente real' };
    const plan = planValidation(broken, 'diseño web para agencias', 'es');
    expect(plan.repair).toHaveLength(1);
    expect(plan.repair[0]?.type).toBe('contrast');
    expect(plan.repair[0]?.reasons.some((r) => r.includes('line2'))).toBe(true);
  });

  it('cover off-topic → marcada para repair (anclaje al topic)', () => {
    const offTopic = [...goodSet];
    offTopic[0] = { type: 'cover', line1: 'Recetas de cocina italiana auténtica' };
    const plan = planValidation(offTopic, 'diseño web para agencias', 'es');
    expect(plan.repair.some((r) => r.type === 'cover')).toBe(true);
  });

  it('observation off-topic → marcada para repair', () => {
    const offTopic = [...goodSet];
    offTopic[1] = {
      type: 'observation',
      line1: 'Las recetas auténticas usan ingredientes simples y procesos lentos que respetan tradiciones milenarias del Mediterráneo siempre.',
    };
    const plan = planValidation(offTopic, 'diseño web para agencias', 'es');
    expect(plan.repair.some((r) => r.type === 'observation')).toBe(true);
  });

  it('quote off-topic NO se marca (no exigimos anclaje en quote/contrast/stat/cta)', () => {
    const offTopic = [...goodSet];
    offTopic[3] = { type: 'quote', line1: 'La paciencia es la forma más alta de inteligencia práctica.' };
    const plan = planValidation(offTopic, 'diseño web para agencias', 'es');
    // contract OK, off-topic permitido en quote → debe estar en ok
    expect(plan.ok.some((s) => s.type === 'quote')).toBe(true);
  });

  it('slide ausente (solo 5 tipos) → 6º slot va a repair', () => {
    const incomplete = goodSet.slice(0, 5);
    const plan = planValidation(incomplete, 'diseño web para agencias', 'es');
    expect(plan.repair).toHaveLength(1);
    expect(plan.repair[0]?.type).toBe('cta');
  });

  it('palabra prohibida ("synergy") → marcada para repair', () => {
    const banned = [...goodSet];
    banned[4] = {
      type: 'stat',
      number: '7 of 10',
      line1: 'agencies undervalue synergy in their pipelines',
      caption: 'INTERNAL',
    };
    const plan = planValidation(banned, 'agency design', 'en');
    expect(plan.repair.some((r) => r.type === 'stat')).toBe(true);
  });
});

describe('mergeRepair', () => {
  it('mergea slides reparadas en sus slots correspondientes', () => {
    const broken = [...goodSet];
    broken[2] = { type: 'contrast', line1: 'sin line2 falla este contrato editorial entero acá' };
    const plan = planValidation(broken, 'diseño web para agencias', 'es');
    expect(plan.repair).toHaveLength(1);

    const repaired: GeneratedSlide[] = [
      {
        type: 'contrast',
        line1: 'La mayoría diseña sitios para impresionar al equipo y no al cliente que paga',
        line2: 'El cliente paga resultados.',
      },
    ];
    const result = mergeRepair(plan, repaired, 'diseño web para agencias', 'es');
    expect(result.slides).toHaveLength(6);
    expect(result.slides[2]?.line2).toBe('El cliente paga resultados.');
    expect(result.stillBroken).toHaveLength(0);
  });

  it('si la slide reparada todavía no pasa contrato, queda en stillBroken', () => {
    const broken = [...goodSet];
    broken[2] = { type: 'contrast', line1: 'sin line2 falla este contrato editorial entero acá' };
    const plan = planValidation(broken, 'diseño web', 'es');

    const stillBroken: GeneratedSlide[] = [
      { type: 'contrast', line1: 'tampoco trae line2 acá lamentablemente nuevamente' }, // sigue rota
    ];
    const result = mergeRepair(plan, stillBroken, 'diseño web', 'es');
    expect(result.stillBroken).toContain('contrast');
  });
});

describe('deterministicFallback', () => {
  it('genera fallback válido para cada tipo (es)', () => {
    for (const type of DEFAULT_SLIDE_ORDER) {
      const slide = deterministicFallback(type, 'diseño web', 'es');
      expect(slide.type).toBe(type);
      expect(slide.line1.trim().length).toBeGreaterThan(0);
    }
  });

  it('cta y contrast traen line2', () => {
    expect(deterministicFallback('cta', 'X', 'es').line2).toBeTruthy();
    expect(deterministicFallback('contrast', 'X', 'es').line2).toBeTruthy();
  });

  it('stat trae number y caption', () => {
    const s = deterministicFallback('stat', 'X', 'es');
    expect(s.number).toBeTruthy();
    expect(s.caption).toBeTruthy();
  });

  it('inglés respeta language', () => {
    const s = deterministicFallback('cover', 'web design', 'en');
    expect(s.line1).toContain('web design');
  });
});
