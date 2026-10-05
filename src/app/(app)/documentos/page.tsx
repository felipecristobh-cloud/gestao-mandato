import type { Metadata } from "next";
import { EmBreve } from "@/components/layout/em-breve";

export const metadata: Metadata = { title: "Documentos" };

export default function Page() {
  return <EmBreve titulo="Documentos" fase={5} itens={["Upload de ofícios, protocolos, notas e comprovantes", "Armazenamento privado com controle de acesso"]} />;
}
