import {
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  type LucideIcon,
  ListChecks,
  Repeat,
  Settings,
  Target,
  Upload,
  Wand2,
} from "lucide-react";

export type NavBadgeKey = "installments" | "subscriptions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadgeKey;
  title: string;
  subtitle: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Acesso rápido",
    items: [
      {
        href: "/",
        label: "Visão Geral",
        icon: LayoutDashboard,
        title: "Visão Geral Financeira",
        subtitle: "Métricas de faturas, recorrências e previsibilidade futura",
      },
      {
        href: "/importar",
        label: "Importar CSV",
        icon: Upload,
        title: "Importar CSV do Nubank",
        subtitle: "Conciliação incremental sem sobrescrever edições manuais",
      },
      {
        href: "/lancamentos",
        label: "Lançamentos",
        icon: ListChecks,
        title: "Lançamentos",
        subtitle: "CRUD completo, seleção em lote e auditoria de origem",
      },
    ],
  },
  {
    label: "Planejamento & controle",
    items: [
      {
        href: "/faturas",
        label: "Faturas & Parcelas",
        icon: CreditCard,
        badge: "installments",
        title: "Faturas & Parcelas",
        subtitle: "Histórico de ciclos e parcelamentos em andamento",
      },
      {
        href: "/assinaturas",
        label: "Assinaturas Fixas",
        icon: Repeat,
        badge: "subscriptions",
        title: "Assinaturas Fixas",
        subtitle: "Recorrências que comprometem os próximos meses",
      },
      {
        href: "/orcamento",
        label: "Orçamento & Metas",
        icon: Target,
        title: "Orçamento & Metas",
        subtitle: "Categorias, cores e tetos mensais",
      },
      {
        href: "/projecao",
        label: "Projeção 12 Meses",
        icon: CalendarRange,
        title: "Projeção 12 Meses",
        subtitle: "Fluxo futuro consolidado: parcelas, assinaturas e agendados",
      },
      {
        href: "/regras",
        label: "Regras de Limpeza",
        icon: Wand2,
        title: "Regras de Limpeza",
        subtitle: "Dicionário de auto-categorização para importações",
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/configuracoes",
  label: "Configurações",
  icon: Settings,
  title: "Configurações",
  subtitle: "Ciclo da fatura, armazenamento e backup",
};

export function findNavItem(pathname: string): NavItem {
  const all = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];
  return all.find((item) => item.href === pathname) ?? all.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ?? all[0];
}
