import type { BadgeVariant, BadgeColor } from "./Badge.types";

const base = "inline-flex items-center font-medium rounded-full";

const sizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-sm",
} as const;

const colorMap: Record<BadgeColor, Record<BadgeVariant, string>> = {
  default: {
    filled: "bg-surface-tertiary text-text-primary",
    outlined: "border border-border text-text-primary",
    subtle: "bg-surface-secondary text-text-secondary",
  },
  success: {
    filled: "bg-emerald-600 text-white dark:bg-emerald-700",
    outlined: "border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    subtle: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    filled: "bg-amber-600 text-white dark:bg-amber-700",
    outlined: "border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    subtle: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  },
  error: {
    filled: "bg-red-600 text-white dark:bg-red-700",
    outlined: "border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
    subtle: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
  },
  info: {
    filled: "bg-blue-600 text-white dark:bg-blue-700",
    outlined: "border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    subtle: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  },
};

export function getBadgeClasses(
  variant: BadgeVariant,
  color: BadgeColor,
  size: "sm" | "md",
): string {
  return `${base} ${sizes[size]} ${colorMap[color][variant]}`;
}
