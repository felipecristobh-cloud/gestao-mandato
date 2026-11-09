-- CreateEnum
CREATE TYPE "EtapaOportunidade" AS ENUM ('IDEIA', 'ANALISE_POLITICA', 'PESQUISA_JURIDICA', 'ELABORACAO', 'REVISAO', 'AGUARDANDO_VEREADOR', 'APROVADA_INTERNAMENTE', 'PRONTA_PROTOCOLO', 'PROTOCOLADA', 'EM_TRAMITACAO', 'APROVADA', 'LEI', 'ARQUIVADA', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "TipoTextoOportunidade" AS ENUM ('TEXTO_INICIAL', 'JUSTIFICATIVA', 'FUNDAMENTACAO_CONSTITUCIONAL', 'FUNDAMENTACAO_MUNICIPAL', 'PARECER_JURIDICO', 'SUGESTOES_EQUIPE', 'VERSAO_FINAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CategoriaDocumento" ADD VALUE 'ESTUDO';
ALTER TYPE "CategoriaDocumento" ADD VALUE 'MINUTA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoHistoricoOportunidade" ADD VALUE 'ETAPA';
ALTER TYPE "TipoHistoricoOportunidade" ADD VALUE 'TEXTO';
ALTER TYPE "TipoHistoricoOportunidade" ADD VALUE 'VINCULO';

-- AlterTable
ALTER TABLE "documento" ADD COLUMN     "oportunidade_id" UUID;

-- AlterTable
ALTER TABLE "oportunidade" ADD COLUMN     "demanda_origem_id" UUID,
ADD COLUMN     "etapa" "EtapaOportunidade" NOT NULL DEFAULT 'IDEIA';

-- CreateTable
CREATE TABLE "oportunidade_texto" (
    "id" UUID NOT NULL,
    "oportunidade_id" UUID NOT NULL,
    "tipo" "TipoTextoOportunidade" NOT NULL,
    "versao" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "autor_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oportunidade_texto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidade_vinculo" (
    "id" UUID NOT NULL,
    "oportunidade_id" UUID NOT NULL,
    "demanda_id" UUID,
    "emenda_id" UUID,
    "compromisso_id" UUID,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oportunidade_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oportunidade_texto_oportunidade_id_tipo_versao_key" ON "oportunidade_texto"("oportunidade_id", "tipo", "versao");

-- CreateIndex
CREATE INDEX "oportunidade_vinculo_demanda_id_idx" ON "oportunidade_vinculo"("demanda_id");

-- CreateIndex
CREATE INDEX "oportunidade_vinculo_emenda_id_idx" ON "oportunidade_vinculo"("emenda_id");

-- CreateIndex
CREATE INDEX "oportunidade_vinculo_compromisso_id_idx" ON "oportunidade_vinculo"("compromisso_id");

-- CreateIndex
CREATE UNIQUE INDEX "oportunidade_vinculo_oportunidade_id_demanda_id_key" ON "oportunidade_vinculo"("oportunidade_id", "demanda_id");

-- CreateIndex
CREATE UNIQUE INDEX "oportunidade_vinculo_oportunidade_id_emenda_id_key" ON "oportunidade_vinculo"("oportunidade_id", "emenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "oportunidade_vinculo_oportunidade_id_compromisso_id_key" ON "oportunidade_vinculo"("oportunidade_id", "compromisso_id");

-- CreateIndex
CREATE INDEX "documento_oportunidade_id_idx" ON "documento"("oportunidade_id");

-- CreateIndex
CREATE INDEX "oportunidade_etapa_idx" ON "oportunidade"("etapa");

-- CreateIndex
CREATE INDEX "oportunidade_demanda_origem_id_idx" ON "oportunidade"("demanda_origem_id");

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_demanda_origem_id_fkey" FOREIGN KEY ("demanda_origem_id") REFERENCES "demanda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_texto" ADD CONSTRAINT "oportunidade_texto_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_texto" ADD CONSTRAINT "oportunidade_texto_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_vinculo" ADD CONSTRAINT "oportunidade_vinculo_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_vinculo" ADD CONSTRAINT "oportunidade_vinculo_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_vinculo" ADD CONSTRAINT "oportunidade_vinculo_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_vinculo" ADD CONSTRAINT "oportunidade_vinculo_compromisso_id_fkey" FOREIGN KEY ("compromisso_id") REFERENCES "compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_vinculo" ADD CONSTRAINT "oportunidade_vinculo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Anexo pode ser de uma oportunidade (continua no máximo um vínculo por arquivo).
ALTER TABLE "documento" DROP CONSTRAINT "documento_um_vinculo";
ALTER TABLE "documento" ADD CONSTRAINT "documento_um_vinculo" CHECK (num_nonnulls("demanda_id", "emenda_id", "entidade_id", "oportunidade_id") <= 1);

ALTER TABLE "oportunidade_vinculo" ADD CONSTRAINT "oportunidade_vinculo_um_alvo" CHECK (num_nonnulls("demanda_id", "emenda_id", "compromisso_id") = 1);

ALTER TABLE "oportunidade_texto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oportunidade_vinculo" ENABLE ROW LEVEL SECURITY;
