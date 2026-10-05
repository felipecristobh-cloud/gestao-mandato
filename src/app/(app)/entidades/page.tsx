import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Entidades" };

export default function Page() {
  return <EmBreve titulo="Entidades" fase={5} itens={["Cadastro de entidades com CNPJ, área e regional", "Vínculos com demandas, emendas, reuniões e documentos"]} />;
}
