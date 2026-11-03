-- Fase 8 — Mapa: localização da demanda (exata) e centro aproximado do bairro.
ALTER TABLE "bairro" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "demanda" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
