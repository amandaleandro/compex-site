-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('INFORMATIVA', 'ACIONAVEL');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'CRITICA');

-- AlterTable
ALTER TABLE "Notification"
  ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'INFORMATIVA',
  ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "resolved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "entity" TEXT,
  ADD COLUMN "entityId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userEmail_kind_resolved_idx" ON "Notification"("userEmail", "kind", "resolved");

-- CreateIndex
CREATE INDEX "Notification_entity_entityId_idx" ON "Notification"("entity", "entityId");
