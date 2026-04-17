# @carrousel/bff

Backend-for-frontend liviano (Vercel Edge Function) que proxifica la API de Claude y oculta la API key del cliente.

**Estado:** stub. Se implementa en el hito 6 del plan (`.claude/plans/vast-painting-teacup.md`).

## Endpoint previsto

`POST /api/generate` — recibe `{ topic, count, language }`, valida con zod, aplica rate limit (10 req/60s por IP) y llama a Anthropic usando `process.env.ANTHROPIC_API_KEY`.
