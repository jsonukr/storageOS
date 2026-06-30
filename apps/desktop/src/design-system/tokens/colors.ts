export const colors = {
  surface: "var(--color-surface)",
  surfaceSecondary: "var(--color-surface-secondary)",
  surfaceTertiary: "var(--color-surface-tertiary)",
  border: "var(--color-border)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  accent: "var(--color-accent)",
  accentHover: "var(--color-accent-hover)",
  sidebar: "var(--color-sidebar)",
  statusbar: "var(--color-statusbar)",
} as const;

export const semanticColors = {
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
} as const;

export type SemanticColor = keyof typeof semanticColors;
