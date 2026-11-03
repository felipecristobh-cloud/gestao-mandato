import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Parlamentares e Mandatos" };

export default function Page() {
  return <EmBreve titulo="Parlamentares e Mandatos" fase={3} itens={["Vereadores, deputados estaduais e federais, senadores", "Vários mandatos por pessoa", "Rede de mandatos parceiros"]} />;
}
