import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Demandas" };

export default function Page() {
  return <EmBreve titulo="Demandas" fase={2} itens={["Cadastro rápido (+ Nova Demanda) com alerta de duplicidade", "Encaminhamentos a órgãos e retornos", "Filtros combinados, status, prazos e histórico"]} />;
}
