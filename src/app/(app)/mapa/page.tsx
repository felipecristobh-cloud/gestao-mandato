import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Mapa" };

export default function Page() {
  return <EmBreve titulo="Mapa" fase={8} itens={["Mapa das demandas de Belo Horizonte por regional e bairro", "Filtros por tema, status e período"]} />;
}
