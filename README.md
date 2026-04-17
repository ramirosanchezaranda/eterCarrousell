# carrouselCore v2

Editor de carruseles para redes sociales con motor de layout profesional. Plantillas con slots, anti-overlap, contraste WCAG automático, escalado tipográfico fluido y paleta armónica por imagen.

## Estructura

Monorepo con pnpm workspaces:

- `apps/web` — frontend (Vite + React 18 + TypeScript estricto)
- `apps/bff` — backend-for-frontend liviano (Vercel Edge Functions) que proxifica la API de Claude
- `packages/shared` — schemas zod compartidos

## Scripts

```bash
pnpm install        # instala dependencias en todos los workspaces
pnpm dev            # levanta apps/web en http://localhost:5173
pnpm dev:bff        # stub por ahora; implementado en el hito 6
pnpm build          # build de producción de apps/web
pnpm typecheck      # tsc --noEmit en todos los paquetes
```

## Plan de migración

El plan completo vive en `.claude/plans/vast-painting-teacup.md` del home del usuario. La app actual corre sobre el monolito original (`apps/web/src/legacy/index.tsx`) y se va reemplazando módulo a módulo según los hitos 1–16.

## Estado actual

- Hito 1 ✅ — monorepo, Vite+React+TS, código legacy encapsulado.
- Hitos 2–16 ⏳ — en progreso según plan.
