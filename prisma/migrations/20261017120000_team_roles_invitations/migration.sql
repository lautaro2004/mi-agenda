-- Equipo compartido Nexo + Nodo: acceso por producto en Membership e
-- invitaciones. Aditiva e idempotente (IF NOT EXISTS) — se puede aplicar
-- también desde el SQL Editor de Supabase.
--
-- Membership.products: default ['nexo','crm'] → TODAS las membresías
-- existentes (dueños) conservan exactamente el acceso que tienen hoy.
ALTER TABLE "public"."Membership" ADD COLUMN IF NOT EXISTS "products" TEXT[] NOT NULL DEFAULT ARRAY['nexo', 'crm']::TEXT[];

CREATE TABLE IF NOT EXISTS "public"."Invitation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "products" TEXT[] DEFAULT ARRAY['crm']::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON "public"."Invitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "Invitation_businessId_idx" ON "public"."Invitation"("businessId");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "public"."Invitation"("email");

DO $$ BEGIN
  ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
