import { CabecalhoPagina, Cartao } from "@/components/ui";

export function EmBreve({ titulo, fase, itens }: { titulo: string; fase: number; itens: string[] }) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} descricao={`Módulo previsto para a Fase ${fase} do roadmap.`} />
      <Cartao>
        <p className="text-sm text-slate-700">Este módulo ainda não foi construído. Vai incluir:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {itens.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </Cartao>
    </>
  );
}
