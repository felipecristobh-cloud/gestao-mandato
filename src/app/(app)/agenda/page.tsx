import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return <EmBreve titulo="Agenda" fase={5} itens={["Reuniões, visitas, plenárias, audiências e eventos", "Vínculos com demandas, emendas, entidades e mandatos"]} />;
}
