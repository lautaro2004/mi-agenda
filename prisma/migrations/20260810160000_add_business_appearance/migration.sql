-- Apariencia mínima del sitio público: imagen de hero y color de marca.
-- logoUrl ya existía (hasta ahora almacenaba base64 desde el uploader viejo
-- del onboarding; a partir de este cambio pasa a guardar URLs públicas de
-- Supabase Storage, sin migrar datos existentes).
ALTER TABLE "Business" ADD COLUMN "heroImageUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN "brandColor" TEXT;
