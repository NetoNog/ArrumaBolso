import {
  ArrowLeftRight,
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  type LucideIcon,
  ListChecks,
  PawPrint,
  Repeat,
  Settings,
  Target,
  Upload,
  Wallet,
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
        label: "Importar extrato",
        icon: Upload,
        title: "Importar fatura ou extrato (CSV/OFX)",
        subtitle: "Cartões de crédito e conta corrente com conciliação incremental",
      },
      {
        href: "/lancamentos",
        label: "Lançamentos",
        icon: ListChecks,
        title: "Lançamentos",
        subtitle: "CRUD completo, divisão, tags, filtros avançados e exportação CSV",
      },
      {
        href: "/fluxo",
        label: "Entradas & Saídas",
        icon: ArrowLeftRight,
        title: "Entradas & Saídas",
        subtitle: "Fluxo do mês: o que entrou, o que saiu e quanto sobrou",
      },
    ],
  },
  {
    label: "Planejamento & controle",
    items: [
      {
        href: "/renda",
        label: "Salário & Renda",
        icon: Wallet,
        title: "Salário & Renda",
        subtitle: "Fontes mensais, 13º/PLR/sazonais e histórico completo",
      },
      {
        href: "/faturas",
        label: "Faturas & Parcelas",
        icon: CreditCard,
        badge: "installments",
        title: "Faturas & Parcelas",
        subtitle: "Cartões, conferência de fatura, antecipação e parcelamentos",
      },
      {
        href: "/assinaturas",
        label: "Assinaturas & Fixas",
        icon: Repeat,
        badge: "subscriptions",
        title: "Assinaturas & Contas Fixas",
        subtitle: "Recorrências mensais/anuais, detecção automática e baixa em 1 clique",
      },
      {
        href: "/orcamento",
        label: "Orçamento & Metas",
        icon: Target,
        title: "Orçamento & Metas",
        subtitle: "Tetos por categoria, sugestões automáticas e metas de economia",
      },
      {
        href: "/meu-pet",
        label: "Meu Pet",
        icon: PawPrint,
        title: "Meu Pet",
        subtitle: "Cadastro de pets, gastos vinculados por pet, tipos de despesa e evolução",
      },
      {
        href: "/projecao",
        label: "Projeção 12 Meses",
        icon: CalendarRange,
        title: "Projeção 12 Meses",
        subtitle: "Fluxo futuro consolidado e simulador “Cabe no bolso?”",
      },
      {
        href: "/analises",
        label: "Análises & Ranking",
        icon: BarChart3,
        title: "Análises & Ranking Anual",
        subtitle: "Mapa de calor, gastos formiga, Raio-X de lojas e ranking anual",
      },
      {
        href: "/fechamento",
        label: "Fechamento do Mês",
        icon: ClipboardCheck,
        title: "Fechamento Guiado do Mês",
        subtitle: "Rotina em 4 passos: triagem, faturas, boletim executivo e metas",
      },
      {
        href: "/regras",
        label: "Regras de Limpeza",
        icon: Wand2,
        title: "Regras de Limpeza",
        subtitle: "Regex, faixas de valor, auto-assinatura e prévia antes de reaplicar",
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/configuracoes",
  label: "Configurações",
  icon: Settings,
  title: "Configurações",
  subtitle: "Perfil, ciclo da fatura, cartões, conta e backup",
};

export function findNavItem(pathname: string): NavItem {
  const all = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];
  return all.find((item) => item.href === pathname) ?? all.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ?? all[0];
}
