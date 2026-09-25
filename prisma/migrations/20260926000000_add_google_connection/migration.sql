-- Conexión Google (Gmail/Calendar) compartida por Nexo y Nodo. Aditiva.
CREATE TABLE "public"."GoogleConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "scopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleConnection_businessId_userId_key" ON "public"."GoogleConnection"("businessId", "userId");
CREATE INDEX "GoogleConnection_businessId_idx" ON "public"."GoogleConnection"("businessId");

ALTER TABLE "public"."GoogleConnection"
    ADD CONSTRAINT "GoogleConnection_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."GoogleConnection"
    ADD CONSTRAINT "GoogleConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convención de seguridad del proyecto: RLS habilitado (deny-all). Prisma
-- conecta como postgres (BYPASSRLS), así que no cambia nada para la app.
ALTER TABLE "public"."GoogleConnection" ENABLE ROW LEVEL SECURITY;
