import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return <EmBreve titulo="Relatórios" fase={7} itens={["Relatórios de demandas e emendas em PDF, Excel e CSV", "Indicadores de resolução e execução financeira"]} />;
}
