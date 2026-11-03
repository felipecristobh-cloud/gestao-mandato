import type { Permissao } from "@/server/authz";

export type ItemMenu = { href: string; rotulo: string; icone: string; fase?: number; permissao?: Permissao };

export const MENU: ItemMenu[] = [
  { href: "/dashboard", rotulo: "Dashboard", icone: "LayoutDashboard" },
  { href: "/demandas", rotulo: "Demandas", icone: "Inbox", fase: 2 },
  { href: "/emendas", rotulo: "Emendas", icone: "Landmark", fase: 4 },
  { href: "/parlamentares", rotulo: "Parlamentares e Mandatos", icone: "Users", fase: 3 },
  { href: "/entidades", rotulo: "Entidades", icone: "Building2", fase: 5 },
  { href: "/agenda", rotulo: "Agenda", icone: "CalendarDays", fase: 5 },
  { href: "/mapa", rotulo: "Mapa", icone: "Map", fase: 8 },
  { href: "/relatorios", rotulo: "Relatórios", icone: "FileBarChart", fase: 7 },
  { href: "/documentos", rotulo: "Documentos", icone: "FileText", fase: 5 },
  { href: "/usuarios", rotulo: "Usuários", icone: "UserCog", permissao: "usuarios:gerenciar" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "Settings" },
];
