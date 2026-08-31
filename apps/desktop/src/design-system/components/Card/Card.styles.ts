import type { CardVariant } from "./Card.types";

const base = "rounded-[8px] transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)]";

const variants: Record<CardVariant, string> = {
  default: "bg-surface-card border border-border-card",
  outlined: "bg-transparent border border-border",
  elevated: "bg-surface-card shadow-[var(--shadow-card)]",
};

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
} as const;

export function getCardClasses(
  variant: CardVariant,
  padding: keyof typeof paddings,
): string {
  return `${base} ${variants[variant]} ${paddings[padding]}`;
}
