-- Resource: entidad física reservable (cancha, sala, silla, profesional...).
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Resource_businessId_name_key" ON "Resource"("businessId", "name");
CREATE INDEX "Resource_businessId_idx" ON "Resource"("businessId");

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ServiceResource: tabla puente N:M entre Service y Resource.
CREATE TABLE "ServiceResource" (
    "serviceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceResource_pkey" PRIMARY KEY ("serviceId", "resourceId")
);

CREATE INDEX "ServiceResource_resourceId_idx" ON "ServiceResource"("resourceId");

ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Appointment.resourceId: nullable, cero impacto en filas existentes.
ALTER TABLE "Appointment" ADD COLUMN "resourceId" TEXT;
CREATE INDEX "Appointment_resourceId_idx" ON "Appointment"("resourceId");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Protección contra doble reserva del MISMO recurso en el MISMO date+startTime
-- exacto (no es detección de solapamiento por rango de tiempo — date/startTime
-- siguen siendo string, a propósito, ver discusión previa). Postgres ya trata
-- los NULL de resourceId como distintos entre sí en un índice único, así que
-- esto no restringe en nada a los turnos sin recurso.
CREATE UNIQUE INDEX "Appointment_resource_slot_key"
    ON "Appointment" ("resourceId", "date", "startTime")
    WHERE status IN ('pending', 'confirmed');

-- Mismo mecanismo para el comportamiento YA existente (agenda general del
-- negocio, sin recursos): antes solo se validaba en la aplicación
-- (findFirst-then-create, con una condición de carrera real); esto agrega la
-- misma garantía a nivel de base. Filtrado a resourceId IS NULL para no
-- chocar con turnos de distintos recursos que comparten businessId+horario.
CREATE UNIQUE INDEX "Appointment_business_slot_key"
    ON "Appointment" ("businessId", "date", "startTime")
    WHERE status IN ('pending', 'confirmed') AND "resourceId" IS NULL;
