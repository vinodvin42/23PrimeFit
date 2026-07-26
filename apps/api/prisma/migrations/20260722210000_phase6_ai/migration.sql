-- CreateTable
CREATE TABLE "BloodReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "markersJson" TEXT NOT NULL,
    "summary" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "source" TEXT NOT NULL DEFAULT 'rules',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiologicalAgeSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chronologicalAge" DOUBLE PRECISION NOT NULL,
    "biologicalAge" DOUBLE PRECISION NOT NULL,
    "deltaYears" DOUBLE PRECISION NOT NULL,
    "factorsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiologicalAgeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodReport_userId_createdAt_idx" ON "BloodReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiInsight_userId_createdAt_idx" ON "AiInsight"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BiologicalAgeSnapshot_userId_createdAt_idx" ON "BiologicalAgeSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BloodReport" ADD CONSTRAINT "BloodReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiologicalAgeSnapshot" ADD CONSTRAINT "BiologicalAgeSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
