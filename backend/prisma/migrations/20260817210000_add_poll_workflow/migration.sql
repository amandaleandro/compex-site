-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('RASCUNHO', 'AGENDADA', 'ABERTA', 'ENCERRADA', 'VALIDADA');

-- AlterTable (sem linhas existentes em Poll no momento desta migration — sem backfill necessário)
ALTER TABLE "Poll"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "rules" TEXT,
  ADD COLUMN "audience" JSONB,
  ADD COLUMN "status" "PollStatus" NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN "startAt" TIMESTAMP(3),
  ADD COLUMN "tied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tieBreakMethod" TEXT,
  ADD COLUMN "officialWinnerIndex" INTEGER,
  ADD COLUMN "validatedByName" TEXT,
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "validationNote" TEXT,
  ADD COLUMN "createdByEmail" TEXT;

-- CreateIndex
CREATE INDEX "Poll_status_startAt_idx" ON "Poll"("status", "startAt");

-- CreateIndex
CREATE INDEX "Poll_status_expiresAt_idx" ON "Poll"("status", "expiresAt");
