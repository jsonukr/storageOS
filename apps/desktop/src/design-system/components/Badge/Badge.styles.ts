import type { BadgeVariant, BadgeColor } from "./Badge.types";

const base = "inline-flex items-center font-medium rounded-full";

const sizes = {
  sm: "px-1.5 py-px text-[11px]",
  md: "px-2 py-0.5 text-[12px]",
} as const;

const colorMap: Record<BadgeColor, Record<BadgeVariant, string>> = {
  default: {
    filled: "bg-surface-tertiary text-text-primary",
    outlined: "border border-border text-text-primary",
    subtle: "bg-surface-secondary text-text-secondary",
  },
  success: {
    filled: "bg-success text-white",
    outlined: "border border-success/30 text-success",
    subtle: "bg-[var(--color-success-bg)] text-success",
  },
  warning: {
    filled: "bg-warning text-white",
    outlined: "border border-warning/30 text-warning",
    subtle: "bg-[var(--color-warning-bg)] text-warning",
  },
  error: {
    filled: "bg-danger text-white",
    outlined: "border border-danger/30 text-danger",
    subtle: "bg-[var(--color-danger-bg)] text-danger",
  },
  info: {
    filled: "bg-accent text-white",
    outlined: "border border-accent/30 text-accent",
    subtle: "bg-accent-subtle text-accent",
  },
};

export function getBadgeClasses(
  variant: BadgeVariant,
  color: BadgeColor,
  size: "sm" | "md",
): string {
  return `${base} ${sizes[size]} ${colorMap[color][variant]}`;
}
