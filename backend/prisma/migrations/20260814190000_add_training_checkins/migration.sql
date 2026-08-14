CREATE TABLE "TrainingCheckIn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "checkedByEmail" TEXT NOT NULL,
    "checkedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingCheckIn_sessionId_memberId_key" ON "TrainingCheckIn"("sessionId", "memberId");

ALTER TABLE "TrainingCheckIn" ADD CONSTRAINT "TrainingCheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TeamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCheckIn" ADD CONSTRAINT "TrainingCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
