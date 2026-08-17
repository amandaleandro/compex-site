-- CreateEnum
CREATE TYPE "NewsType" AS ENUM ('NOTICIA', 'COMUNICADO', 'NOVIDADE', 'RESULTADO', 'EVENTO', 'CAMPANHA', 'CHAMADA', 'AVISO_IMPORTANTE');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'AGENDADO', 'PUBLICADO', 'ARQUIVADO');

-- AlterTable (colunas novas primeiro como nullable / com default, para poder popular linhas existentes)
ALTER TABLE "News"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "type" "NewsType" NOT NULL DEFAULT 'NOTICIA',
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "authorName" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "status" "NewsStatus" NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN "highlighted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "channels" JSONB,
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill das linhas existentes (o modelo antigo só tinha published boolean)
UPDATE "News" SET
  "slug" = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || substr(id, 1, 8),
  "authorName" = 'Sistema',
  "channels" = '["HOME", "PORTAL"]'::jsonb,
  "status" = (CASE WHEN "published" THEN 'PUBLICADO' ELSE 'RASCUNHO' END)::"NewsStatus";

-- Agora que todas as linhas têm valor, torna obrigatório
ALTER TABLE "News"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "authorName" SET NOT NULL,
  ALTER COLUMN "channels" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");

-- CreateIndex
CREATE INDEX "News_status_publishAt_idx" ON "News"("status", "publishAt");
