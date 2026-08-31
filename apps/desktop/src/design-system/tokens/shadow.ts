export const shadow = {
  none: "shadow-none",
  card: "shadow-[var(--shadow-card)]",
  tooltip: "shadow-[var(--shadow-tooltip)]",
  flyout: "shadow-[var(--shadow-flyout)]",
  dialog: "shadow-[var(--shadow-dialog)]",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
} as const;

export type Shadow = keyof typeof shadow;
