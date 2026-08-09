-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Asistente',
    "role" TEXT NOT NULL DEFAULT 'Recepcionista Virtual',
    "description" TEXT,
    "formality" TEXT NOT NULL DEFAULT 'neutral',
    "warmth" TEXT NOT NULL DEFAULT 'balanced',
    "emojiUsage" TEXT NOT NULL DEFAULT 'low',
    "responseLength" TEXT NOT NULL DEFAULT 'medium',
    "commercialLevel" TEXT NOT NULL DEFAULT 'balanced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeGoal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRestriction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCapability" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_businessId_key" ON "Employee"("businessId");

-- CreateIndex
CREATE INDEX "EmployeeGoal_employeeId_idx" ON "EmployeeGoal"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRestriction_employeeId_idx" ON "EmployeeRestriction"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCapability_employeeId_idx" ON "EmployeeCapability"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCapability_employeeId_key_key" ON "EmployeeCapability"("employeeId", "key");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeGoal" ADD CONSTRAINT "EmployeeGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRestriction" ADD CONSTRAINT "EmployeeRestriction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCapability" ADD CONSTRAINT "EmployeeCapability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
