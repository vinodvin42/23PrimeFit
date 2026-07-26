CREATE TABLE "FemaleHealthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "typicalCycleLength" INTEGER,
    "typicalPeriodLength" INTEGER,
    "lastPeriodStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FemaleHealthProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CycleLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CycleLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SymptomCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "dateKey" TEXT NOT NULL,
    "symptoms" TEXT[] NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SymptomCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthspanSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "dateKey" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "biologicalAge" DOUBLE PRECISION,
    "pace" DOUBLE PRECISION,
    "trend" TEXT,
    "pillarsJson" TEXT NOT NULL,
    "coverageConfidence" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthspanSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FemaleHealthProfile_userId_key" ON "FemaleHealthProfile"("userId");
CREATE INDEX "FemaleHealthProfile_tenantId_idx" ON "FemaleHealthProfile"("tenantId");
CREATE INDEX "CycleLog_userId_periodStart_idx" ON "CycleLog"("userId", "periodStart");
CREATE INDEX "CycleLog_tenantId_idx" ON "CycleLog"("tenantId");
CREATE INDEX "SymptomCheckIn_userId_dateKey_idx" ON "SymptomCheckIn"("userId", "dateKey");
CREATE INDEX "SymptomCheckIn_tenantId_idx" ON "SymptomCheckIn"("tenantId");
CREATE UNIQUE INDEX "HealthspanSnapshot_userId_dateKey_modelVersion_key" ON "HealthspanSnapshot"("userId", "dateKey", "modelVersion");
CREATE INDEX "HealthspanSnapshot_userId_dateKey_idx" ON "HealthspanSnapshot"("userId", "dateKey");
CREATE INDEX "HealthspanSnapshot_tenantId_idx" ON "HealthspanSnapshot"("tenantId");

ALTER TABLE "FemaleHealthProfile" ADD CONSTRAINT "FemaleHealthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FemaleHealthProfile" ADD CONSTRAINT "FemaleHealthProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CycleLog" ADD CONSTRAINT "CycleLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CycleLog" ADD CONSTRAINT "CycleLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SymptomCheckIn" ADD CONSTRAINT "SymptomCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SymptomCheckIn" ADD CONSTRAINT "SymptomCheckIn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthspanSnapshot" ADD CONSTRAINT "HealthspanSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthspanSnapshot" ADD CONSTRAINT "HealthspanSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
