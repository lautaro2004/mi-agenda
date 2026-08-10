-- Un servicio no puede repetirse por nombre dentro del mismo negocio (pero
-- el mismo nombre sí puede existir en negocios distintos). Habilita que
-- createService() sea un upsert idempotente.
CREATE UNIQUE INDEX "Service_businessId_name_key" ON "Service"("businessId", "name");
