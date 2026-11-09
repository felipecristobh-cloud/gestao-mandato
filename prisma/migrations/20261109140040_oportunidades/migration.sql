-- CreateEnum
CREATE TYPE "PrioridadeOportunidade" AS ENUM ('MAXIMA', 'ALTA', 'INTERMEDIARIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "TipoHistoricoOportunidade" AS ENUM ('CRIACAO', 'EDICAO', 'AVALIACAO', 'PRIORIDADE');

-- DropIndex

-- DropIndex

-- CreateTable
CREATE TABLE "eixo_legislativo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "eixo_legislativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidade" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "descricao_problema" TEXT NOT NULL,
    "publico" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "solucao" TEXT NOT NULL,
    "resultados" TEXT,
    "fundamentacao" TEXT,
    "legislacao_relacionada" TEXT,
    "projetos_semelhantes" TEXT,
    "parceiros" TEXT,
    "eixo_id" INTEGER NOT NULL,
    "responsavel_id" UUID,
    "nota_impacto" SMALLINT,
    "nota_alcance" SMALLINT,
    "nota_viabilidade" SMALLINT,
    "nota_execucao" SMALLINT,
    "nota_inovacao" SMALLINT,
    "nota_final" SMALLINT,
    "prioridade_manual" "PrioridadeOportunidade",
    "justificativa_prioridade" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidade_bairro" (
    "oportunidade_id" UUID NOT NULL,
    "bairro_id" INTEGER NOT NULL,

    CONSTRAINT "oportunidade_bairro_pkey" PRIMARY KEY ("oportunidade_id","bairro_id")
);

-- CreateTable
CREATE TABLE "oportunidade_regional" (
    "oportunidade_id" UUID NOT NULL,
    "regional_id" INTEGER NOT NULL,

    CONSTRAINT "oportunidade_regional_pkey" PRIMARY KEY ("oportunidade_id","regional_id")
);

-- CreateTable
CREATE TABLE "oportunidade_historico" (
    "id" UUID NOT NULL,
    "oportunidade_id" UUID NOT NULL,
    "usuario_id" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoHistoricoOportunidade" NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "oportunidade_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eixo_legislativo_nome_key" ON "eixo_legislativo"("nome");

-- CreateIndex
CREATE INDEX "oportunidade_eixo_id_idx" ON "oportunidade"("eixo_id");

-- CreateIndex
CREATE INDEX "oportunidade_nota_final_idx" ON "oportunidade"("nota_final");

-- CreateIndex
CREATE INDEX "oportunidade_criado_em_idx" ON "oportunidade"("criado_em");

-- CreateIndex
CREATE INDEX "oportunidade_bairro_bairro_id_idx" ON "oportunidade_bairro"("bairro_id");

-- CreateIndex
CREATE INDEX "oportunidade_regional_regional_id_idx" ON "oportunidade_regional"("regional_id");

-- CreateIndex
CREATE INDEX "oportunidade_historico_oportunidade_id_data_idx" ON "oportunidade_historico"("oportunidade_id", "data");

-- AddForeignKey
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_eixo_id_fkey" FOREIGN KEY ("eixo_id") REFERENCES "eixo_legislativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_bairro" ADD CONSTRAINT "oportunidade_bairro_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_bairro" ADD CONSTRAINT "oportunidade_bairro_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_regional" ADD CONSTRAINT "oportunidade_regional_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_regional" ADD CONSTRAINT "oportunidade_regional_regional_id_fkey" FOREIGN KEY ("regional_id") REFERENCES "regional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_historico" ADD CONSTRAINT "oportunidade_historico_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidade_historico" ADD CONSTRAINT "oportunidade_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (fecha a API REST do Supabase para as tabelas novas)
ALTER TABLE "eixo_legislativo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oportunidade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oportunidade_bairro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oportunidade_regional" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oportunidade_historico" ENABLE ROW LEVEL SECURITY;
