"use client";

import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatarMoeda } from "@/lib/emendas";

export type ItemGrafico = { rotulo: string; valor: number; href?: string; cor?: string };

export const CORES = ["#a51d1d", "#e0782f", "#d4a017", "#0f766e", "#2563eb", "#7c3aed", "#db2777", "#65a30d", "#0891b2", "#64748b"];
const MARCA = "#a51d1d";
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });
const moedaCompacta = (c: number) => compacto.format(c / 100);
const curto = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);
const eixo = { fontSize: 12, fill: "#475569" };

function useIr() {
  const router = useRouter();
  return (d: unknown) => {
    const href = (d as { payload?: { href?: string } } | undefined)?.payload?.href;
    if (href) router.push(href);
  };
}

function Vazio() {
  return <p className="py-10 text-center text-sm text-slate-500">Sem dados no período.</p>;
}

export function Barras({ dados, titulo, moeda }: { dados: ItemGrafico[]; titulo: string; moeda?: boolean }) {
  const ir = useIr();
  if (!dados.length) return <Vazio />;
  return (
    <div role="img" aria-label={`${titulo}: ${dados.map((d) => `${d.rotulo} ${d.valor}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 30 + 30)}>
        <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={eixo} tickFormatter={moeda ? moedaCompacta : undefined} />
          <YAxis type="category" dataKey="rotulo" width={150} tick={eixo} tickFormatter={curto} interval={0} />
          <Tooltip formatter={(v) => (moeda ? formatarMoeda(Number(v)) : String(v))} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="valor" name={moeda ? "Valor" : "Quantidade"} radius={[0, 4, 4, 0]} cursor="pointer" onClick={ir}>
            {dados.map((d, i) => <Cell key={i} fill={d.cor ?? MARCA} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Rosca({ dados, titulo }: { dados: ItemGrafico[]; titulo: string }) {
  const ir = useIr();
  if (!dados.length) return <Vazio />;
  return (
    <div role="img" aria-label={`${titulo}: ${dados.map((d) => `${d.rotulo} ${d.valor}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={dados} dataKey="valor" nameKey="rotulo" innerRadius="55%" outerRadius="85%" paddingAngle={1} cursor="pointer" onClick={ir}>
            {dados.map((d, i) => <Cell key={i} fill={d.cor ?? CORES[i % CORES.length]} />)}
          </Pie>
          <Tooltip />
          <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinhaMeses({ dados }: { dados: { mes: string; novas: number; concluidas: number }[] }) {
  if (!dados.some((d) => d.novas || d.concluidas)) return <Vazio />;
  return (
    <div role="img" aria-label={`Demandas por mês: ${dados.map((d) => `${d.mes} ${d.novas} entradas, ${d.concluidas} concluídas`).join("; ")}`}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={dados} margin={{ left: -16, right: 16, top: 8 }}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="mes" tick={eixo} />
          <YAxis allowDecimals={false} tick={eixo} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="novas" name="Entradas" stroke={MARCA} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="concluidas" name="Concluídas" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type LinhaExecucao = { rotulo: string; aprovado: number; empenhado: number; liquidado: number; pago: number; href?: string };

export function Execucao({ dados }: { dados: LinhaExecucao[] }) {
  const ir = useIr();
  if (!dados.some((d) => d.aprovado || d.empenhado)) return <Vazio />;
  const series: [keyof LinhaExecucao, string, string][] = [
    ["aprovado", "Aprovado/indicado", "#cbd5e1"], ["empenhado", "Empenhado", "#d4a017"], ["liquidado", "Liquidado", "#e0782f"], ["pago", "Pago", "#0f766e"],
  ];
  return (
    <div role="img" aria-label={`Execução financeira: ${dados.map((d) => `${d.rotulo} aprovado ${formatarMoeda(d.aprovado)}, pago ${formatarMoeda(d.pago)}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dados} margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="rotulo" tick={eixo} />
          <YAxis tick={eixo} tickFormatter={moedaCompacta} width={72} />
          <Tooltip formatter={(v) => formatarMoeda(Number(v))} cursor={{ fill: "#f1f5f9" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map(([k, nome, cor]) => (
            <Bar key={k} dataKey={k} name={nome} fill={cor} radius={[4, 4, 0, 0]} cursor="pointer" onClick={ir} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type LinhaMandato = { rotulo: string; autoria: number; outras: number; href?: string };

export function EmendasPorMandato({ dados }: { dados: LinhaMandato[] }) {
  const ir = useIr();
  if (!dados.length) return <Vazio />;
  return (
    <div role="img" aria-label={`Emendas por parlamentar: ${dados.map((d) => `${d.rotulo} ${d.autoria} de autoria, ${d.outras} outras participações`).join("; ")}`}>
      <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 32 + 50)}>
        <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 24, top: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={eixo} />
          <YAxis type="category" dataKey="rotulo" width={150} tick={eixo} tickFormatter={curto} interval={0} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="autoria" name="Autor/coautor" stackId="m" fill={MARCA} cursor="pointer" onClick={ir} />
          <Bar dataKey="outras" name="Outras participações" stackId="m" fill="#94a3b8" radius={[0, 4, 4, 0]} cursor="pointer" onClick={ir} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
