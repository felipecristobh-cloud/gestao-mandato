-- CreateEnum
CREATE TYPE "TipoEntidade" AS ENUM ('ASSOCIACAO', 'OSC', 'COLETIVO', 'ESCOLA', 'SAUDE', 'RELIGIOSA', 'COOPERATIVA', 'SINDICATO', 'EMPRESA', 'ORGAO_PUBLICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoCompromisso" AS ENUM ('REUNIAO', 'VISITA', 'PLENARIA', 'AUDIENCIA', 'EVENTO', 'REUNIAO_INSTITUCIONAL', 'REUNIAO_ENTIDADE', 'ATIVIDADE_EXTERNA');

-- CreateEnum
CREATE TYPE "StatusCompromisso" AS ENUM ('SOLICITADO', 'CONFIRMADO', 'REALIZADO', 'ADIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoHistoricoCompromisso" AS ENUM ('CRIACAO', 'EDICAO', 'STATUS', 'VINCULO', 'RESULTADO', 'COMENTARIO');

-- AlterTable
ALTER TABLE "demanda" ADD COLUMN     "entidade_id" UUID;

-- AlterTable
ALTER TABLE "emenda" ADD COLUMN     "entidade_id" UUID;

-- CreateTable
CREATE TABLE "entidade" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" CHAR(14),
    "tipo" "TipoEntidade" NOT NULL DEFAULT 'ASSOCIACAO',
    "tema_id" INTEGER,
    "endereco" TEXT,
    "bairro_id" INTEGER,
    "telefone" TEXT,
    "email" TEXT,
    "responsavel" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidade_mandato" (
    "id" UUID NOT NULL,
    "entidade_id" UUID NOT NULL,
    "mandato_id" UUID NOT NULL,
    "tipo" "TipoParticipacao" NOT NULL,
    "observacoes" TEXT,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidade_mandato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromisso" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoCompromisso" NOT NULL,
    "status" "StatusCompromisso" NOT NULL DEFAULT 'SOLICITADO',
    "inicio" TIMESTAMPTZ(6) NOT NULL,
    "fim" TIMESTAMPTZ(6) NOT NULL,
    "local" TEXT,
    "bairro_id" INTEGER,
    "pauta" TEXT,
    "resultado" TEXT,
    "encaminhamentos" TEXT,
    "agenda_vereador" BOOLEAN NOT NULL DEFAULT false,
    "responsavel_id" UUID,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromisso_participante" (
    "compromisso_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "compromisso_participante_pkey" PRIMARY KEY ("compromisso_id","usuario_id")
);

-- CreateTable
CREATE TABLE "compromisso_vinculo" (
    "id" UUID NOT NULL,
    "compromisso_id" UUID NOT NULL,
    "demanda_id" UUID,
    "emenda_id" UUID,
    "entidade_id" UUID,
    "parlamentar_id" UUID,
    "mandato_id" UUID,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compromisso_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromisso_historico" (
    "id" UUID NOT NULL,
    "compromisso_id" UUID NOT NULL,
    "usuario_id" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoHistoricoCompromisso" NOT NULL,
    "status_anterior" "StatusCompromisso",
    "status_novo" "StatusCompromisso",
    "descricao" TEXT NOT NULL,

    CONSTRAINT "compromisso_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entidade_cnpj_key" ON "entidade"("cnpj");

-- CreateIndex
CREATE INDEX "entidade_nome_idx" ON "entidade"("nome");

-- CreateIndex
CREATE INDEX "entidade_bairro_id_idx" ON "entidade"("bairro_id");

-- CreateIndex
CREATE INDEX "entidade_mandato_mandato_id_idx" ON "entidade_mandato"("mandato_id");

-- CreateIndex
CREATE UNIQUE INDEX "entidade_mandato_entidade_id_mandato_id_tipo_key" ON "entidade_mandato"("entidade_id", "mandato_id", "tipo");

-- CreateIndex
CREATE INDEX "compromisso_inicio_idx" ON "compromisso"("inicio");

-- CreateIndex
CREATE INDEX "compromisso_status_idx" ON "compromisso"("status");

-- CreateIndex
CREATE INDEX "compromisso_responsavel_id_idx" ON "compromisso"("responsavel_id");

-- CreateIndex
CREATE INDEX "compromisso_participante_usuario_id_idx" ON "compromisso_participante"("usuario_id");

-- CreateIndex
CREATE INDEX "compromisso_vinculo_demanda_id_idx" ON "compromisso_vinculo"("demanda_id");

-- CreateIndex
CREATE INDEX "compromisso_vinculo_emenda_id_idx" ON "compromisso_vinculo"("emenda_id");

-- CreateIndex
CREATE INDEX "compromisso_vinculo_entidade_id_idx" ON "compromisso_vinculo"("entidade_id");

-- CreateIndex
CREATE INDEX "compromisso_vinculo_parlamentar_id_idx" ON "compromisso_vinculo"("parlamentar_id");

-- CreateIndex
CREATE INDEX "compromisso_vinculo_mandato_id_idx" ON "compromisso_vinculo"("mandato_id");

-- CreateIndex
CREATE UNIQUE INDEX "compromisso_vinculo_compromisso_id_demanda_id_key" ON "compromisso_vinculo"("compromisso_id", "demanda_id");

-- CreateIndex
CREATE UNIQUE INDEX "compromisso_vinculo_compromisso_id_emenda_id_key" ON "compromisso_vinculo"("compromisso_id", "emenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "compromisso_vinculo_compromisso_id_entidade_id_key" ON "compromisso_vinculo"("compromisso_id", "entidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "compromisso_vinculo_compromisso_id_parlamentar_id_key" ON "compromisso_vinculo"("compromisso_id", "parlamentar_id");

-- CreateIndex
CREATE UNIQUE INDEX "compromisso_vinculo_compromisso_id_mandato_id_key" ON "compromisso_vinculo"("compromisso_id", "mandato_id");

-- CreateIndex
CREATE INDEX "compromisso_historico_compromisso_id_data_idx" ON "compromisso_historico"("compromisso_id", "data");

-- CreateIndex
CREATE INDEX "demanda_entidade_id_idx" ON "demanda"("entidade_id");

-- CreateIndex
CREATE INDEX "emenda_entidade_id_idx" ON "emenda"("entidade_id");

-- AddForeignKey
ALTER TABLE "demanda" ADD CONSTRAINT "demanda_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emenda" ADD CONSTRAINT "emenda_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade" ADD CONSTRAINT "entidade_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "tema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade" ADD CONSTRAINT "entidade_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade" ADD CONSTRAINT "entidade_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade_mandato" ADD CONSTRAINT "entidade_mandato_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade_mandato" ADD CONSTRAINT "entidade_mandato_mandato_id_fkey" FOREIGN KEY ("mandato_id") REFERENCES "mandato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidade_mandato" ADD CONSTRAINT "entidade_mandato_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_participante" ADD CONSTRAINT "compromisso_participante_compromisso_id_fkey" FOREIGN KEY ("compromisso_id") REFERENCES "compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_participante" ADD CONSTRAINT "compromisso_participante_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_compromisso_id_fkey" FOREIGN KEY ("compromisso_id") REFERENCES "compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_emenda_id_fkey" FOREIGN KEY ("emenda_id") REFERENCES "emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_entidade_id_fkey" FOREIGN KEY ("entidade_id") REFERENCES "entidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_parlamentar_id_fkey" FOREIGN KEY ("parlamentar_id") REFERENCES "parlamentar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_mandato_id_fkey" FOREIGN KEY ("mandato_id") REFERENCES "mandato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_historico" ADD CONSTRAINT "compromisso_historico_compromisso_id_fkey" FOREIGN KEY ("compromisso_id") REFERENCES "compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso_historico" ADD CONSTRAINT "compromisso_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras de integridade que o Prisma não expressa
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_fim_apos_inicio" CHECK ("fim" > "inicio");
ALTER TABLE "compromisso_vinculo" ADD CONSTRAINT "compromisso_vinculo_um_alvo"
  CHECK (num_nonnulls("demanda_id", "emenda_id", "entidade_id", "parlamentar_id", "mandato_id") = 1);
ALTER TABLE "entidade" ADD CONSTRAINT "entidade_cnpj_digitos" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9]{14}$');
ALTER TABLE "entidade_mandato" ADD CONSTRAINT "entidade_mandato_sem_autoria" CHECK ("tipo" NOT IN ('AUTOR', 'COAUTOR'));
CREATE INDEX "entidade_nome_trgm" ON "entidade" USING gin ("nome" gin_trgm_ops);
CREATE INDEX "compromisso_periodo" ON "compromisso" ("inicio", "fim");
