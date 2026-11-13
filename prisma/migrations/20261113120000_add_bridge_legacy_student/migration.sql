-- CreateTable
CREATE TABLE "BridgeLegacyStudent" (
    "id" TEXT NOT NULL,
    "sourceUid" TEXT NOT NULL,
    "email" TEXT,
    "level" "BridgeLevel",
    "username" TEXT,
    "estimates" JSONB NOT NULL DEFAULT '{}',
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeLegacyStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeLegacyStudent_sourceUid_key" ON "BridgeLegacyStudent"("sourceUid");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeLegacyStudent_email_key" ON "BridgeLegacyStudent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeLegacyStudent_claimedByUserId_key" ON "BridgeLegacyStudent"("claimedByUserId");

-- CreateIndex
CREATE INDEX "BridgeLegacyStudent_claimedAt_idx" ON "BridgeLegacyStudent"("claimedAt");

-- AddForeignKey
ALTER TABLE "BridgeLegacyStudent" ADD CONSTRAINT "BridgeLegacyStudent_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
