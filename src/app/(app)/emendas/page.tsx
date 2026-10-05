import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Emendas" };

export default function Page() {
  return <EmBreve titulo="Emendas" fase={4} itens={["Emendas municipais, estaduais e federais", "Valores indicados, empenhados, liquidados e pagos, com saldos calculados", "Mandatos envolvidos e tipo de participação (autoria separada de acompanhamento)"]} />;
}
