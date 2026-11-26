"use client";

import { CategoryIcon } from "@/components/common/category-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category } from "@/lib/domain/types";

const NONE = "__none__";

export function orderCategoriesHierarchy(categories: readonly Category[]): { category: Category; isChild: boolean }[] {
  const byId = new Map(categories.map((cat) => [cat.id, cat]));
  const roots = categories.filter((cat) => !cat.parent_id || !byId.has(cat.parent_id));
  const childrenByParent = new Map<string, Category[]>();
  for (const cat of categories) {
    if (cat.parent_id && byId.has(cat.parent_id)) {
      childrenByParent.set(cat.parent_id, [...(childrenByParent.get(cat.parent_id) ?? []), cat]);
    }
  }
  const ordered: { category: Category; isChild: boolean }[] = [];
  for (const root of roots) {
    ordered.push({ category: root, isChild: false });
    for (const child of childrenByParent.get(root.id) ?? []) {
      ordered.push({ category: child, isChild: true });
    }
  }
  return ordered;
}

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
  const ordered = orderCategoriesHierarchy(categories);
  const byId = new Map(categories.map((cat) => [cat.id, cat]));
  const items: Record<string, string> = { [NONE]: placeholder };
  for (const { category, isChild } of ordered) {
    const parent = isChild && category.parent_id ? byId.get(category.parent_id) : undefined;
    items[category.id] = parent ? `${parent.name} › ${category.name}` : category.name;
  }
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
        {ordered.map(({ category, isChild }) => (
          <SelectItem key={category.id} value={category.id} className={isChild ? "pl-6" : undefined}>
            {isChild ? <span className="text-muted-foreground">↳</span> : null}
            <CategoryIcon icon={category.icon} color={category.color} className="inline-flex size-4 items-center justify-center rounded" />
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
