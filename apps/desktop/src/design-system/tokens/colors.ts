export const colors = {
  surface: "var(--color-surface)",
  surfaceSecondary: "var(--color-surface-secondary)",
  surfaceTertiary: "var(--color-surface-tertiary)",
  surfaceCard: "var(--color-surface-card)",
  surfaceFlyout: "var(--color-surface-flyout)",
  surfaceDialog: "var(--color-surface-dialog)",
  surfaceInput: "var(--color-surface-input)",
  border: "var(--color-border)",
  borderSubtle: "var(--color-border-subtle)",
  borderStrong: "var(--color-border-strong)",
  borderCard: "var(--color-border-card)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  textTertiary: "var(--color-text-tertiary)",
  textDisabled: "var(--color-text-disabled)",
  accent: "var(--color-accent)",
  accentHover: "var(--color-accent-hover)",
  accentSubtle: "var(--color-accent-subtle)",
  accentText: "var(--color-accent-text)",
  sidebar: "var(--color-sidebar)",
  statusbar: "var(--color-statusbar)",
} as const;

export const semanticColors = {
  success: {
    bg: "bg-[var(--color-success-bg)]",
    text: "text-[var(--color-success)]",
    border: "border-[var(--color-success)]/20",
  },
  warning: {
    bg: "bg-[var(--color-warning-bg)]",
    text: "text-[var(--color-warning)]",
    border: "border-[var(--color-warning)]/20",
  },
  error: {
    bg: "bg-[var(--color-danger-bg)]",
    text: "text-[var(--color-danger)]",
    border: "border-[var(--color-danger)]/20",
  },
  info: {
    bg: "bg-[var(--color-info-bg)]",
    text: "text-[var(--color-info)]",
    border: "border-[var(--color-info)]/20",
  },
} as const;

export type SemanticColor = keyof typeof semanticColors;
