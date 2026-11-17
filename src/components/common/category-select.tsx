"use client";

import { CategoryIcon } from "@/components/common/category-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category } from "@/lib/domain/types";

const NONE = "__none__";

export function CategorySelect({
  categories,
  value,
  onChange,
  size = "default",
  className,
  placeholder = "Sem categoria",
  disabled,
  ariaLabel = "Categoria",
}: {
  categories: readonly Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  size?: "sm" | "default";
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const items: Record<string, string> = { [NONE]: placeholder };
  for (const category of categories) items[category.id] = category.name;
  const current = value && items[value] ? value : NONE;

  return (
    <Select
      items={items}
      value={current}
      disabled={disabled}
      onValueChange={(next) => onChange(!next || next === NONE ? null : next)}
    >
      <SelectTrigger size={size} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">{placeholder}</span>
        </SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <CategoryIcon icon={category.icon} color={category.color} className="inline-flex size-4 items-center justify-center rounded" />
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
