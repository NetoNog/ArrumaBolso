import {
  ArrowLeftRight,
  Baby,
  BookOpen,
  Car,
  Clapperboard,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  PawPrint,
  Plane,
  Repeat,
  Shapes,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  Zap,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  repeat: Repeat,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  clapperboard: Clapperboard,
  "arrow-left-right": ArrowLeftRight,
  shapes: Shapes,
  house: House,
  zap: Zap,
  plane: Plane,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  shirt: Shirt,
  smartphone: Smartphone,
  "paw-print": PawPrint,
  baby: Baby,
  tag: Tag,
};

export const CATEGORY_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#10B981",
  "#16A34A",
  "#EAB308",
  "#F97316",
  "#E11D48",
  "#EC4899",
  "#8B5CF6",
  "#64748B",
];

export function CategoryIcon({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  return (
    <span
      className={className ?? "inline-flex size-6 shrink-0 items-center justify-center rounded-md"}
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <Icon className="size-3.5" />
    </span>
  );
}
