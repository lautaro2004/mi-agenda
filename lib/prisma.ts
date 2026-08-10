import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Pool chico y con timeouts explícitos, pensado para serverless (Netlify):
// - "max" bajo porque cada contenedor tiene su propio pool (este singleton
//   se reusa entre invocaciones "warm" de un mismo contenedor, pero cada
//   contenedor frío arranca el suyo); 5 alcanza para el fan-out típico de
//   Promise.all de este proyecto (ej. buildBusinessContext) sin acercarse al
//   límite del pooler de Supabase.
// - "connectionTimeoutMillis" explícito porque el default de pg (0 = sin
//   timeout propio) puede colgarse mucho más de lo razonable si el host es
//   inalcanzable, en vez de fallar rápido con un error claro.
// - onPoolError/onConnectionError: un socket idle que "muere" mientras el
//   contenedor está congelado entre invocaciones (Supavisor recicla
//   conexiones idle) puede emitir un error de pg.Pool sin listener — eso es
//   un ETIMEDOUT/ECONNRESET crudo tirando abajo el proceso. Loguearlo acá
//   evita eso y deja rastro real de cuándo pasa.
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL ?? "",
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    },
    {
      onPoolError: (err) => console.error("[prisma] Error en el pool de conexiones:", err),
      onConnectionError: (err) => console.error("[prisma] Error de conexión individual:", err),
    }
  );
  return new PrismaClient({ adapter });
}

// Lazy singleton — defer instantiation until first query so Next.js build doesn't fail
// when DATABASE_URL is not yet set.
export function getPrisma(): PrismaClient {
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient();
  }
  return globalThis.__prisma;
}

// Convenience export for direct use in server code
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
