import type { Permissao } from "@/server/authz";

export type ItemMenu = { href: string; rotulo: string; icone: string; fase?: number; permissao?: Permissao };

export const MENU: ItemMenu[] = [
  { href: "/dashboard", rotulo: "Dashboard", icone: "LayoutDashboard" },
  { href: "/demandas", rotulo: "Demandas", icone: "Inbox" },
  { href: "/emendas", rotulo: "Emendas", icone: "Landmark" },
  { href: "/parlamentares", rotulo: "Parlamentares e Mandatos", icone: "Users" },
  { href: "/entidades", rotulo: "Entidades", icone: "Building2" },
  { href: "/agenda", rotulo: "Agenda", icone: "CalendarDays" },
  { href: "/mapa", rotulo: "Mapa", icone: "Map" },
  { href: "/relatorios", rotulo: "Relatórios", icone: "FileBarChart" },
  { href: "/documentos", rotulo: "Documentos", icone: "FileText", fase: 9 },
  { href: "/usuarios", rotulo: "Usuários", icone: "UserCog", permissao: "usuarios:gerenciar" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "Settings" },
];
