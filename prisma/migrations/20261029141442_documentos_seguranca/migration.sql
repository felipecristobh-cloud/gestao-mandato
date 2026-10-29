-- Fase 9 — Documentos (upload privado), anonimização LGPD e índice para limite de login por IP.
-- CreateEnum
CREATE TYPE "CategoriaDocumento" AS ENUM ('OFICIO', 'PROTOCOLO', 'NOTA', 'COMPROVANTE', 'FOTO', 'PLANO_TRABALHO', 'TERMO', 'OUTRO');

-- AlterEnum
ALTER TYPE "AcaoAuditoria" ADD VALUE 'DOWNLOAD';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'ANONIMIZAR';

-- AlterTable
ALTER TABLE "pessoa" ADD COLUMN     "anonimizado_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL DEFAULT 'OUTRO',
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "caminho" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "descricao" TEXT,
    "restrito" BOOLEAN NOT NULL DEFAULT false,
    "demanda_id" UUID,
    "emenda_id" UUID,
    "entidade_id" UUID,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documento_caminho_key" ON "documento"("caminho");

-- CreateIndex
CREATE INDEX "documento_demanda_id_idx" ON "documento"("demanda_id");

-- CreateIndex
CREATE INDEX "documento_emenda_id_idx" ON "documento"("emenda_id");

-- CreateIndex
CREATE INDEX "documento_entidade_id_idx" ON "documento"("entidade_id");

-- CreateIndex
CREATE INDEX "documento_criado_em_idx" ON "documento"("criado_em");

-- CreateIndex
CREATE INDEX "audit_log_acao_ip_data_idx" ON "audit_log"("acao", "ip", "data");

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Um documento pertence a no máximo um registro (demanda, emenda ou entidade).
ALTER TABLE "documento" ADD CONSTRAINT "documento_um_vinculo" CHECK (num_nonnulls("demanda_id", "emenda_id", "entidade_id") <= 1);
